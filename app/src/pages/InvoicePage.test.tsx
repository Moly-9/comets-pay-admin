import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CreatorProfile, GeneratedInvoiceRecord, Payout } from '../types';
import { InvoicePage } from './OperationalPages';

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
    tab?: 'signature' | 'review';
    focusedInvoiceId?: string | null;
  } = {},
) => renderToStaticMarkup(
  <InvoicePage
    payouts={options.payouts ?? [payout]}
    creators={options.creators ?? [creator]}
    invoiceEntity={{ name: 'COMETS', address: 'Hong Kong' }}
    generatedInvoices={options.generatedInvoices ?? [record]}
    requests={[]}
    tab={options.tab ?? 'signature'}
    onTabChange={vi.fn()}
    onCreateInvoice={vi.fn()}
    onCreateBatchInvoice={vi.fn()}
    canCreateInvoice={false}
    canManageInvoice={canManageInvoice}
    canReviewMedia={false}
    canReviewFinance={false}
    canEditProjectResourceInvoice={() => false}
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
    expect(html).toContain('lucide-circle-check');
  });

  it('hides the simulated signature action from read-only users', () => {
    expect(renderInvoicePage(false)).not.toContain('模拟达人完成签署');
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

    expect(html.match(/<th(?:\s|>)/g)).toHaveLength(8);
    expect(html).toContain('<th>达人</th>');
    expect(html).toContain('<th>关联项目</th>');
    expect(html).toContain('<th>Invoice 编号</th>');
    expect(html).toContain('<th>Invoice 类型</th>');
    expect(html).toContain('<th>付款渠道</th>');
    expect(html).toContain('<th>状态</th>');
    expect(html).toContain('>金额</th>');
    expect(html).toContain('>操作</th>');
    expect(html).toContain('Signature Demo Display Name');
    expect(html).toContain('@signature-channel-id');
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
});
