import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GeneratedInvoiceRecord, Payout } from '../types';
import { InvoicePage } from './OperationalPages';

const snapshot = {
  invoiceNumber: 'INV-SIGNATURE-DEMO',
  invoiceDate: '2026-08-11',
  billTo: { name: 'COMETS', address: 'Hong Kong' },
  creatorHandle: '@signature-demo',
  creatorName: 'Signature Demo Creator',
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
  account: '•••• 0000',
  status: '未进入付款',
  invoiceReviewStatus: '待签署',
  invoiceSnapshot: snapshot,
  accent: '#64748b',
};

const record: GeneratedInvoiceRecord = {
  id: 'INV-SIGNATURE-DEMO',
  invoiceId: 'invoice_signature_demo' as GeneratedInvoiceRecord['invoiceId'],
  sourcePayoutId: payout.id,
  status: '待签署',
  generatedAt: '2026-08-11T10:00:00.000Z',
  validationStatus: 'valid',
  snapshot,
};

const renderInvoicePage = (canManageInvoice: boolean) => renderToStaticMarkup(
  <InvoicePage
    payouts={[payout]}
    creators={[]}
    invoiceEntity={{ name: 'COMETS', address: 'Hong Kong' }}
    generatedInvoices={[record]}
    requests={[]}
    tab="signature"
    onTabChange={vi.fn()}
    onCreateInvoice={vi.fn()}
    onCreateBatchInvoice={vi.fn()}
    canCreateInvoice={false}
    canManageInvoice={canManageInvoice}
    canReviewMedia={false}
    canReviewFinance={false}
    canEditProjectResourceInvoice={() => false}
    focusedInvoiceId={null}
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
  it('shows a direct simulated signature action beside the detail action', () => {
    const html = renderInvoicePage(true);

    expect(html).toContain('查看详情');
    expect(html).toContain('模拟达人完成签署');
    expect(html).toContain('aria-label="模拟达人完成签署：INV-SIGNATURE-DEMO"');
    expect(html).toContain('lucide-circle-check');
  });

  it('hides the simulated signature action from read-only users', () => {
    expect(renderInvoicePage(false)).not.toContain('模拟达人完成签署');
  });
});
