import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_INVOICE_BILLING_SETTINGS } from '../data';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { InvoicePage } from './OperationalPages';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const snapshot = {
  invoiceNumber: 'INV-SIGNATURE-DEMO',
  invoiceDate: '2026-08-11',
  billTo: { name: 'COMETS', address: 'Hong Kong' },
  creatorHandle: '@signature-demo',
  creatorName: 'Signature Demo Creator',
  creatorId: 'creator_signature_demo',
  projectId: 'project_signature_demo',
  projectName: 'Signature Demo Project',
  contractIds: [],
  from: {
    legalName: 'Signature Demo Creator',
    address: 'Singapore',
    phone: '+65 6000 0000',
    email: 'signature@example.test',
  },
  currency: 'USD',
  items: [{
    id: 'signature-demo-item',
    description: 'Creator service',
    unitPrice: 100,
    quantity: 1,
    lineTotal: 100,
  }],
  paymentMethod: 'bank',
  payment: {
    bankCountry: 'SG',
    accountName: 'Signature Demo Creator',
    accountType: 'Checking',
    swiftCode: 'TESTSG00',
    accountNumber: '0000000000',
    iban: '',
    beneficiaryType: 'PERSONAL',
    bankName: 'Synthetic Bank',
    bankStreetAddress: 'Singapore',
    bankCity: 'Singapore',
    bankState: '',
    bankPostalCode: '000000',
    intermediaryBankCountry: '',
    intermediaryBankCode: '',
    transferRemarks: '',
    paypalUsername: '',
    paypalEmail: '',
  },
} as unknown as GeneratedInvoiceRecord['snapshot'];

const payout: Payout = {
  id: 'payout_signature_demo',
  creator: 'Signature Demo Creator',
  handle: '@signature-demo',
  initials: 'SD',
  projectId: 'project_signature_demo',
  project: 'Signature Demo Project',
  contract: '未关联合同',
  invoice: 'INV-SIGNATURE-DEMO',
  provider: 'Airwallex',
  currency: 'USD',
  amount: 100,
  creatorId: 'creator_signature_demo' as Payout['creatorId'],
  account: '•••• 0000',
  status: '未进入付款',
  invoiceReviewStatus: '待签署',
  invoiceSnapshot: snapshot,
  accent: '#64748b',
};

const creator = {
  id: 'creator_signature_demo',
  initials: 'SC',
  accent: '#0f766e',
  name: 'Signature Demo Display Name',
  handle: '@signature-fallback',
  contact: {
    legalName: 'Signature Demo Company Ltd.',
    address: 'Singapore',
    phone: '+65 6000 0000',
    email: 'signature@example.test',
  },
  socialAccounts: [{
    id: 'social_signature_demo',
    platform: 'YouTube',
    handle: '@signature-channel-id',
    profileUrl: 'https://example.test/signature-channel-id',
  }],
} as CreatorProfile;

const record: GeneratedInvoiceRecord = {
  id: 'INV-SIGNATURE-DEMO',
  invoiceId: 'invoice_signature_demo' as GeneratedInvoiceRecord['invoiceId'],
  sourcePayoutId: payout.id,
  status: '待签署',
  generatedAt: '2026-08-11T10:00:00.000Z',
  validationStatus: 'valid',
  snapshot,
};

const renderInvoicePage = (
  canManageInvoice: boolean,
  options: {
    payouts?: Payout[];
    generatedInvoices?: GeneratedInvoiceRecord[];
    creators?: CreatorProfile[];
    requests?: RequestProjectSummary[];
    tab?: 'signature' | 'upload' | 'review' | 'approved' | 'returned';
    focusedInvoiceId?: string | null;
    canEditProjectResourceInvoice?: boolean;
  } = {},
) => renderToStaticMarkup(
  <InvoicePage
    payouts={options.payouts ?? [payout]}
    creators={options.creators ?? [creator]}
    invoiceBillingSettings={INITIAL_INVOICE_BILLING_SETTINGS}
    generatedInvoices={options.generatedInvoices ?? [record]}
    requests={options.requests ?? []}
    tab={options.tab ?? 'signature'}
    onTabChange={vi.fn()}
    onCreateInvoice={vi.fn()}
    onCreateBatchInvoice={vi.fn()}
    canCreateInvoice={false}
    canManageInvoice={canManageInvoice}
    canReviewMedia={false}
    canReviewFinance={false}
    canEditProjectResourceInvoice={() => options.canEditProjectResourceInvoice ?? false}
    focusedInvoiceId={options.focusedInvoiceId ?? null}
    onFocusCleared={vi.fn()}
    onMarkSigned={vi.fn()}
    onReviewAction={vi.fn()}
    onReplyFeedback={vi.fn()}
    onSendSignatureReminder={() => true}
    onEditInvoice={vi.fn()}
    onOpenProject={vi.fn()}
    onOpenRequest={vi.fn()}
    onOpenPayment={vi.fn()}
    canExecutePayout={false}
    notify={vi.fn()}
  />,
);

describe('InvoicePage waiting-signature actions', () => {
  it('shows detail and simulated signature actions and keeps the Invoice number linked to detail', () => {
    const html = renderInvoicePage(true);

    expect(html).toContain('aria-label="查看 Invoice INV-SIGNATURE-DEMO"');
    expect(html).toContain('查看详情');
    expect(html).toContain('模拟达人完成签署');
    expect(html).toContain('aria-label="模拟达人完成签署：INV-SIGNATURE-DEMO"');
    expect(html).toContain('lucide-wallet-cards');
  });

  it('hides the simulated signature action from read-only users', () => {
    expect(renderInvoicePage(false)).not.toContain('模拟达人完成签署');
  });

  it('only marks internal drafts as publishable in the waiting-signature list', () => {
    const draftPayout = { ...payout, invoiceReviewStatus: '草稿' as const };
    const draftRecord = { ...record, status: '草稿' as const };
    const html = renderInvoicePage(true, { payouts: [draftPayout], generatedInvoices: [draftRecord] });

    expect(html).toContain('一键发布');
    expect(html).toContain('title="选择并发布"');
    expect(html).toContain('草稿');
    expect(html).not.toContain('模拟达人完成签署');
  });

  it('uses the simulated signing timestamp in legacy Invoice previews without a generated snapshot', () => {
    const signedPayout: Payout = {
      ...payout,
      invoiceReviewStatus: '待媒介审核',
      invoiceSignedAt: '2026-08-14T10:00:00.000+08:00',
      invoiceSnapshot: undefined,
    };
    const html = renderInvoicePage(true, {
      payouts: [signedPayout],
      generatedInvoices: [],
      tab: 'review',
      focusedInvoiceId: signedPayout.id,
    });

    expect(html).toContain('<b>Date:</b> 14 Aug 2026');
  });
});

describe('InvoicePage list columns', () => {
  it('renders the requested data columns plus operations and resolves creator identity by stable ID', () => {
    const html = renderInvoicePage(true);

    expect(html.match(/<th(?:\s|>)/g)).toHaveLength(10);
    expect(html).toContain('<th>达人</th>');
    expect(html).toContain('<th>开票主体</th>');
    expect(html).toContain('<th>关联项目</th>');
    expect(html).toContain('<th>Invoice 编号</th>');
    expect(html).toContain('<th>Invoice 类型</th>');
    expect(html).toContain('<th>付款渠道</th>');
    expect(html).toContain('<th>状态</th>');
    expect(html).toContain('>金额</th>');
    expect(html).toContain('>操作</th>');
    expect(html).toContain('Signature Demo Display Name');
    expect(html).toContain('@signature-channel-id');
    expect(html).toContain('Signature Demo Company Ltd.');
    expect(html).toContain('Signature Demo Project');
    expect(html).toContain('内部 Invoice');
  });

  it('renders five tabs in the required order', () => {
    const html = renderInvoicePage(true);
    const labels = ['待签署', '待采集', '待审核', '已通过', '已退回'];
    labels.reduce((previousIndex, label) => {
      const index = html.indexOf(`>${label} <span>`);
      expect(index).toBeGreaterThan(previousIndex);
      return index;
    }, -1);
  });

  it('renders four lifecycle overview cards above the Invoice list', () => {
    const html = renderInvoicePage(true);

    expect(html).toContain('aria-label="Invoice 概览"');
    expect(html.match(/invoice-overview-card invoice-overview-card-/g)).toHaveLength(4);
    expect(html).toContain('Invoice 总数');
    expect(html).toContain('待达人处理');
    expect(html).toContain('待内部处理');
    expect(html).toContain('已通过 Invoice');
    expect(html).toContain('1 内部 · 0 外部');
    expect(html).toContain('1 待签署 · 0 待采集');
  });

  it('shows common filters on every tab and limits Invoice type to review result tabs', () => {
    const signatureHtml = renderInvoicePage(true);
    expect(signatureHtml).toContain('aria-label="Invoice 列表筛选"');
    expect(signatureHtml).toContain('aria-label="关联项目筛选"');
    expect(signatureHtml).toContain('全部关联项目');
    expect(signatureHtml).toContain('aria-label="付款渠道筛选"');
    expect(signatureHtml).toContain('全部付款渠道');
    expect(signatureHtml).toContain('aria-label="Invoice 状态筛选"');
    expect(signatureHtml).toContain('全部状态');
    expect(signatureHtml).not.toContain('aria-label="Invoice 类型筛选"');

    const reviewHtml = renderInvoicePage(true, {
      payouts: [{ ...payout, invoiceReviewStatus: '待媒介审核' }],
      generatedInvoices: [{ ...record, status: '待媒介审核' }],
      tab: 'review',
    });
    expect(reviewHtml).toContain('aria-label="Invoice 类型筛选"');
    expect(reviewHtml).toContain('全部 Invoice 类型');

    const uploadHtml = renderInvoicePage(true, { tab: 'upload' });
    expect(uploadHtml).toContain('aria-label="关联项目筛选"');
    expect(uploadHtml).not.toContain('aria-label="Invoice 类型筛选"');
  });

  it('places the lifecycle note before the publish action when the action is visible', () => {
    const signatureHtml = renderInvoicePage(true);
    expect(signatureHtml.indexOf('列表、详情和审核记录使用同一生命周期'))
      .toBeLessThan(signatureHtml.indexOf('一键发布'));
  });

  it('keeps creator feedback rows on the detail-first flow', () => {
    const feedbackPayout: Payout = {
      ...payout,
      invoiceReviewStatus: '达人反馈',
      creatorFeedback: {
        reason: '请修改 Invoice 地址后重新发起签署。',
        actorName: '达人',
        occurredAt: '2026-08-11T11:00:00.000Z',
      },
    };
    const html = renderInvoicePage(true, {
      payouts: [feedbackPayout],
      tab: 'review',
    });

    expect(html).toContain('查看详情');
    expect(html).not.toContain('修改并重新发布');
  });

  it('shows only the return source label below a returned status', () => {
    const returnedPayout: Payout = {
      ...payout,
      status: '已退回',
      invoiceReviewStatus: '已退回',
      paymentFailureReturn: {
        issueType: 'INVOICE_CONTENT',
        reason: 'Invoice 金额填写错误，请修改后重新发起。',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-08-11T12:00:00.000Z',
        restartStage: 'SIGNATURE',
      },
    };
    const html = renderInvoicePage(true, {
      payouts: [returnedPayout],
      tab: 'returned',
    });

    expect(html).toContain('付款失败退回 · Invoice');
    expect(html).not.toContain('Invoice 金额填写错误，请修改后重新发起。');
    expect(html).toContain('查看详情');
    expect(html).not.toContain('修改并重新发起');
  });

  it('keeps a payment-account failure in the approved payment flow', () => {
    const accountFailure: Payout = {
      ...payout,
      status: '已退回',
      invoiceReviewStatus: '已通过',
      paymentFailureReturn: {
        issueType: 'PAYMENT_LIST',
        reason: '请更新付款账户后重新执行付款。',
        actorAccount: 'finance',
        actorName: '财务',
        occurredAt: '2026-08-11T12:00:00.000Z',
        restartStage: 'PAYMENT_LIST_RESUBMISSION',
      },
      paymentFailureRecovery: {
        status: 'AWAITING_CREATOR_UPDATE',
        notifications: [],
      },
    };
    const html = renderInvoicePage(true, {
      payouts: [accountFailure],
      generatedInvoices: [{ ...record, status: '已通过' }],
      tab: 'approved',
    });

    expect(html).toContain('付款中');
    expect(html).toContain('查看详情');
    expect(html).not.toContain('付款失败退回 · 付款账户');
  });

  it('shows only a finance-scoped Invoice-content return in the returned tab', () => {
    const returnItems = [{
      pageKey: `invoice:${record.invoiceId}`,
      invoiceId: record.invoiceId,
      invoiceNumber: record.snapshot.invoiceNumber,
      issueType: 'INVOICE_CONTENT' as const,
      reason: 'Invoice 主体需要修改',
      paymentItems: [],
    }];
    const returnedRequest = {
      id: 'request-returned-invoice',
      lifecycle: 'RETURNED',
      invoiceIds: [record.invoiceId],
      project: 'Signature Demo Project',
      brand: 'Demo Brand',
      media: 'Jeff',
      pm: 'PM',
      amount: 'USD 100.00',
      contracts: 0,
      invoices: 1,
      paymentOrder: '已生成',
      status: '已退回',
      filter: 'pending',
      approval: {
        status: 'RETURNED_TO_MEDIA_REVIEW',
        round: 1,
        history: [{
          round: 1,
          stage: 'FINANCE',
          action: 'RETURN',
          actorAccount: 'finance',
          actorName: '财务审核人',
          actorRole: '财务',
          fromStatus: 'PENDING_FINANCE',
          toStatus: 'RETURNED_TO_MEDIA_REVIEW',
          reason: returnItems[0].reason,
          returnItems,
          occurredAt: '2026-08-11T13:00:00.000Z',
        }],
        submittedAt: '2026-08-11T10:00:00.000Z',
        returnedFromStage: 'FINANCE',
        resumeStatus: 'PENDING_FINANCE',
        returnReason: returnItems[0].reason,
        returnItems,
        updatedAt: '2026-08-11T13:00:00.000Z',
      },
    } as RequestProjectSummary;
    const html = renderInvoicePage(true, {
      payouts: [{ ...payout, invoiceReviewStatus: '已通过' }],
      generatedInvoices: [{ ...record, status: '已通过' }],
      requests: [returnedRequest],
      tab: 'returned',
    });

    expect(html).toContain('财务退回 · Invoice');
    expect(html).toContain('查看详情');

    const detailHtml = renderInvoicePage(true, {
      payouts: [{ ...payout, invoiceReviewStatus: '已通过' }],
      generatedInvoices: [{ ...record, status: '已通过' }],
      requests: [returnedRequest],
      tab: 'returned',
      focusedInvoiceId: payout.id,
      canEditProjectResourceInvoice: true,
    });
    expect(detailHtml).toContain('Invoice 主体需要修改');
    expect(detailHtml).toContain('财务审核人');
    expect(detailHtml).toContain('修改并重新发起');
  });
});
