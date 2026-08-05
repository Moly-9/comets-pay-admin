import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeneratedInvoiceRecord, InvoiceEditContext, Payout } from '../types';
import { InvoiceDetailPage } from './InvoiceDetailPage';

const model = {
  invoiceNumber: 'INV-SYNTHETIC',
  invoiceDate: '2026-08-05',
  billTo: { name: 'Synthetic Advertiser', address: 'Synthetic address' },
  creatorHandle: '@synthetic',
  creatorName: 'Synthetic Creator',
  creatorId: 'crt_synthetic',
  engagementId: 'col_synthetic',
  projectId: 'prj_synthetic',
  projectName: 'Synthetic Project',
  contractIds: [],
  from: {
    legalName: 'Synthetic Creator',
    address: 'Synthetic address',
    phone: '+1 000 000 0000',
    email: 'creator@example.test',
  },
  currency: 'USD',
  items: [{
    id: 'item-synthetic',
    description: 'Synthetic service',
    unitPrice: 100,
    quantity: 1,
    lineTotal: 100,
  }],
  paymentMethod: 'bank',
  payment: {
    bankCountry: 'US',
    accountName: 'Synthetic Creator',
    accountType: 'Checking',
    swiftCode: 'TESTUS00',
    accountNumber: '0000000000',
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: 'Synthetic Bank',
    bankStreetAddress: 'Synthetic address',
    bankCity: 'Test City',
    bankState: 'CA',
    bankPostalCode: '00000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: '',
    paypalEmail: '',
  },
} as unknown as GeneratedInvoiceRecord['snapshot'];

const basePayout: Payout = {
  id: 'payout_synthetic',
  creator: 'Synthetic Creator',
  handle: '@synthetic',
  initials: 'SC',
  projectId: 'PRJ-SYNTHETIC',
  project: 'Synthetic Project',
  contract: '未关联合同',
  invoice: 'INV-SYNTHETIC',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 100,
  account: '•••• 0000',
  status: '未进入付款',
  invoiceReviewStatus: '待媒介复核',
  invoiceSnapshot: model,
  accent: '#64748b',
};

const renderDetail = (
  payout: Payout,
  permissions: { manage: boolean; media: boolean },
) => renderToStaticMarkup(
  <InvoiceDetailPage
    source={{ kind: 'payout', payout }}
    model={model}
    onBack={() => undefined}
    onMarkSigned={() => undefined}
    onReviewAction={() => undefined}
    onReplyFeedback={() => undefined}
    onEditInvoice={(_target: Payout, _context: InvoiceEditContext) => undefined}
    canManageInvoice={permissions.manage}
    canReviewMedia={permissions.media}
    canReviewFinance={false}
    notify={() => undefined}
  />,
);

describe('InvoiceDetailPage edit actions', () => {
  it('shows the unified editor entry for creator feedback and media recheck', () => {
    const feedbackHtml = renderDetail({
      ...basePayout,
      invoiceReviewStatus: '达人反馈',
      creatorFeedback: {
        reason: '请修改地址',
        actorName: '媒介',
        occurredAt: '2026-08-05T00:00:00.000Z',
      },
    }, { manage: true, media: false });
    expect(feedbackHtml).toContain('查看反馈');
    expect(feedbackHtml).toContain('修改并重新发送达人');

    const recheckHtml = renderDetail(basePayout, { manage: false, media: true });
    expect(recheckHtml).toContain('修改 Invoice');
    expect(recheckHtml).toContain('复核通过并重新提交');
  });

  it('shows content-failure editing but keeps payment-list failures actionless', () => {
    const contentReturn = {
      ...basePayout,
      status: '已退回' as const,
      invoiceReviewStatus: '已退回' as const,
      paymentFailureReturn: {
        issueType: 'INVOICE_CONTENT' as const,
        reason: 'Invoice 金额错误',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-08-05T01:00:00.000Z',
        restartStage: 'SIGNATURE' as const,
      },
    };
    expect(renderDetail(contentReturn, { manage: true, media: false }))
      .toContain('修改并重新发起');

    const paymentListHtml = renderDetail({
      ...contentReturn,
      paymentFailureReturn: {
        ...contentReturn.paymentFailureReturn,
        issueType: 'PAYMENT_LIST',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
    }, { manage: true, media: true });
    expect(paymentListHtml).toContain('等待项目付款清单重新提交');
    expect(paymentListHtml).not.toContain('修改并重新发起');
    expect(paymentListHtml).not.toContain('复核通过并重新提交');
  });
});
