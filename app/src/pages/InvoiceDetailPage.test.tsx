import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_CONTRACTS } from '../contracts';
import type { GeneratedInvoiceRecord, InvoiceEditContext, Payout } from '../types';
import {
  buildInvoiceSignatureReminderMessage,
  getInvoiceTimelineState,
  InvoiceDetailPage,
  InvoiceFeedbackDeliveryNotice,
  InvoiceSignatureReminderDeliveryNotice,
} from './InvoiceDetailPage';

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
  canEditProjectResource = false,
) => renderToStaticMarkup(
  <InvoiceDetailPage
    source={{ kind: 'payout', payout }}
    model={model}
    onBack={() => undefined}
    onMarkSigned={() => undefined}
    onReviewAction={() => undefined}
    onReplyFeedback={() => undefined}
    onSendSignatureReminder={() => true}
    onEditInvoice={(_target: Payout, _context: InvoiceEditContext) => undefined}
    canManageInvoice={permissions.manage}
    canReviewMedia={permissions.media}
    canReviewFinance={false}
    canEditProjectResource={canEditProjectResource}
    notify={() => undefined}
  />,
);

describe('InvoiceDetailPage edit actions', () => {
  it('uses the linked contract Publisher and shows completed signature evidence', () => {
    const signedModel = {
      ...model,
      creatorName: 'Synthetic Display Name',
      from: { ...model.from, legalName: 'Synthetic Legal Name' },
    };
    const signedPayout: Payout = {
      ...basePayout,
      creator: 'Synthetic Display Name',
      contract: 'CON-SYNTHETIC',
      invoiceReviewStatus: '待媒介审核',
      invoiceSignedAt: '2026-08-14T02:00:00.000Z',
      invoiceSnapshot: signedModel,
    };
    const contract = {
      ...INITIAL_CONTRACTS[0],
      id: 'CON-SYNTHETIC',
      publisher: 'Synthetic Legal Name',
    };
    const html = renderToStaticMarkup(
      <InvoiceDetailPage
        source={{ kind: 'payout', payout: signedPayout }}
        model={signedModel}
        contracts={[contract]}
        onBack={() => undefined}
        onMarkSigned={() => undefined}
        onReviewAction={() => undefined}
        canManageInvoice={false}
        canReviewMedia
        canReviewFinance={false}
        notify={() => undefined}
      />,
    );

    expect(html).toContain('Synthetic Legal Name');
    expect(html).toContain('已完成 5/6 项');
    expect(html).toContain('已签名');
    expect(html).not.toContain('达人尚未完成签署，不能进行审核');
  });

  it('preserves the existing Invoice heading and shows Invoice type first in the four metric cards', () => {
    const html = renderDetail(basePayout, { manage: false, media: true });
    expect(html).toContain('INV-SYNTHETIC');
    expect(html).toContain('Invoice类型');
    expect(html).toContain('内部 Invoice');
    expect(html).toContain('当前状态');
    expect(html).toContain('Invoice金额');
    expect(html).toContain('付款方式');
    expect(html).toContain('invoice-review-workspace is-internal');
    expect(html).toContain('待复核');
    expect(html).not.toContain('待媒介复核');
    expect(html.indexOf('Invoice类型')).toBeLessThan(html.indexOf('当前状态'));
    expect(html.indexOf('contract-metric-grid')).toBeLessThan(html.indexOf('invoice-review-workspace'));
  });

  it('keeps the review summary concise and exposes the unsigned signature state', () => {
    const html = renderDetail(basePayout, { manage: false, media: true });

    expect(html).toContain('核对主体、金额、币种、付款信息和签名状态');
    expect(html).not.toContain('项目及合作项');
    expect(html).toContain('金额和币种');
    expect(html).toContain('USD 100.00');
    expect(html).not.toContain('<small>USD</small>');
    expect(html).toContain('签名区域');
    expect(html).toContain('未签名');
    expect(html).toContain('等待达人签署');
  });

  it('shows the five fixed header actions and enables publish, edit and withdraw for a draft', () => {
    const draftRecord: GeneratedInvoiceRecord = {
      id: 'INV-SYNTHETIC',
      invoiceId: 'invoice-synthetic' as never,
      sourcePayoutId: basePayout.id,
      status: '草稿',
      generatedAt: '2026-08-05T10:00:00.000Z',
      snapshot: model,
      validationStatus: 'valid',
      version: 1,
    };
    const html = renderToStaticMarkup(
      <InvoiceDetailPage
        source={{ kind: 'generated', record: draftRecord, payout: { ...basePayout, invoiceReviewStatus: '草稿' } }}
        model={model}
        onBack={() => undefined}
        onMarkSigned={() => undefined}
        onReviewAction={() => undefined}
        onPublishDraft={() => true}
        onWithdrawDraft={() => true}
        onEditInvoice={() => undefined}
        canManageInvoice
        canReviewMedia={false}
        canReviewFinance={false}
        notify={() => undefined}
      />,
    );

    ['复制编号', '发布达人签署', '编辑', '撤销', '下载PDF'].reduce((previousIndex, label) => {
      const index = html.indexOf(`<span>${label}</span>`);
      expect(index).toBeGreaterThan(previousIndex);
      return index;
    }, -1);
    expect(html).toContain('title="发布并通知达人签署"');
    expect(html).toContain('title="撤销并删除当前草稿"');
  });

  it('enables media approval after the generated Invoice has been signed', () => {
    const record: GeneratedInvoiceRecord = {
      id: 'generated-synthetic',
      invoiceId: 'invoice-synthetic' as never,
      sourcePayoutId: basePayout.id,
      status: '待签署',
      generatedAt: '2026-08-05 10:00',
      snapshot: model,
      validationStatus: 'valid',
      version: 1,
    };
    const unsignedHtml = renderToStaticMarkup(
      <InvoiceDetailPage
        source={{ kind: 'generated', record, payout: basePayout }}
        model={model}
        onBack={() => undefined}
        onMarkSigned={() => undefined}
        onReviewAction={() => undefined}
        canManageInvoice={false}
        canReviewMedia
        canReviewFinance={false}
        notify={() => undefined}
      />,
    );
    expect(unsignedHtml).toContain('5/5项资料校验通过');
    expect(unsignedHtml).toContain('disabled=""');

    const signedModel = { ...model, signatureDate: '2026-08-14', signatureText: 'Synthetic Creator' };
    const signedHtml = renderToStaticMarkup(
      <InvoiceDetailPage
        source={{
          kind: 'generated',
          record: { ...record, status: '待媒介审核', snapshot: signedModel },
          payout: { ...basePayout, invoiceReviewStatus: '待媒介审核', invoiceSignedAt: '2026-08-14T02:00:00.000Z' },
        }}
        model={signedModel}
        onBack={() => undefined}
        onMarkSigned={() => undefined}
        onReviewAction={() => undefined}
        canManageInvoice={false}
        canReviewMedia
        canReviewFinance={false}
        notify={() => undefined}
      />,
    );
    expect(signedHtml).toContain('5/5项资料校验通过');
    expect(signedHtml).toContain('aria-label="电子签名">Synthetic Creator');
    expect(signedHtml).toContain('签名区域');
    expect(signedHtml).toContain('已签名');
    expect(signedHtml).toContain('2026-08-14');
    expect(signedHtml).toContain('审核通过');
    expect(signedHtml).toContain('待审核');
    expect(signedHtml).not.toContain('待媒介审核');
    expect(signedHtml).toMatch(/<button class="button button-primary " type="button">[\s\S]*?<span>审核通过<\/span>/);
  });

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
    expect(feedbackHtml).toMatch(/title="编辑 Invoice"[\s\S]*?<span>编辑<\/span>/);
    expect(feedbackHtml).toContain('达人尚未完成签署');
    expect(getInvoiceTimelineState('达人反馈')).toEqual({
      currentIndex: 1,
      currentStepText: '达人反馈 · 待重新签署',
    });

    const recheckHtml = renderDetail(basePayout, { manage: false, media: true });
    expect(recheckHtml).toContain('<span>编辑</span>');
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
    const contentReturnHtml = renderDetail(contentReturn, { manage: true, media: false });
    expect(contentReturnHtml).toMatch(/title="编辑 Invoice"[\s\S]*?<span>编辑<\/span>/);
    expect(contentReturnHtml).toContain('付款失败退回 · Invoice');
    expect(contentReturnHtml).toContain('Invoice 金额错误');
    expect(contentReturnHtml).toContain('修改并重新发起');

    const paymentListHtml = renderDetail({
      ...contentReturn,
      paymentFailureReturn: {
        ...contentReturn.paymentFailureReturn,
        issueType: 'PAYMENT_LIST',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
    }, { manage: true, media: true });
    expect(paymentListHtml).not.toContain('等待项目付款清单重新提交');
    expect(paymentListHtml).toContain('title="当前状态不可编辑"');
    expect(paymentListHtml).not.toContain('复核通过并重新提交');
  });

  it('allows an editable returned-project Invoice to start a new signature version', () => {
    const html = renderDetail({
      ...basePayout,
      invoiceReviewStatus: '已通过',
    }, { manage: true, media: false }, true);
    expect(html).toMatch(/title="编辑 Invoice"[\s\S]*?<span>编辑<\/span>/);
  });

  it('explains the prototype delivery channels for feedback replies', () => {
    const html = renderToStaticMarkup(
      <InvoiceFeedbackDeliveryNotice email="creator@example.test" />,
    );

    expect(html).toContain('达人端站内信');
    expect(html).toContain('邮件（站外信）');
    expect(html).toContain('creator@example.test');
    expect(html).toContain('当前仅模拟发送');
    expect(html).toContain('失败原因和重试结果');
    expect(html).toContain('操作审计');
  });

  it('shows the signature reminder only for manageable waiting-signature invoices', () => {
    const waitingPayout: Payout = {
      ...basePayout,
      invoiceReviewStatus: '待签署',
    };
    const manageableHtml = renderDetail(waitingPayout, { manage: true, media: false });
    expect(manageableHtml).toContain('通知达人签署');
    expect(manageableHtml).toContain('可通知达人登录系统签署');

    const readOnlyHtml = renderDetail(waitingPayout, { manage: false, media: false });
    expect(readOnlyHtml).toContain('通知达人签署');
    expect(readOnlyHtml).toContain('title="仅待签署状态可以发送提醒"');
    expect(renderDetail(basePayout, { manage: true, media: true }))
      .toContain('title="仅待签署状态可以发送提醒"');
  });

  it('builds the editable reminder copy and explains both simulated channels', () => {
    expect(buildInvoiceSignatureReminderMessage(model)).toBe(
      'Hi Synthetic Creator，Invoice INV-SYNTHETIC 已准备好，请登录达人端系统，在 Invoice 中心查看并完成签署。如有疑问，可通过站内信反馈。',
    );

    const deliveryHtml = renderToStaticMarkup(
      <InvoiceSignatureReminderDeliveryNotice email="" />,
    );
    expect(deliveryHtml).toContain('通知发送渠道');
    expect(deliveryHtml).toContain('达人端站内信');
    expect(deliveryHtml).toContain('未发送 · 达人档案邮箱待补充');
    expect(deliveryHtml).toContain('当前仅模拟发送并保留通知记录');
  });
});
