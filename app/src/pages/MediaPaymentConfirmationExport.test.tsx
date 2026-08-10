import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentListItem, PaymentListRecord } from '../businessWorkflow';
import type { SystemUser } from '../data';
import {
  MediaPaymentProjectsPage,
  createMediaConfirmationArchive,
  mediaConfirmationItemsFor,
} from './MediaPaymentProjectsPage';
import type { RequestProjectSummary } from './RequestProjectDetailPage';

const mediaUser: SystemUser = {
  account: 'media.test',
  name: '媒介测试账号',
  email: 'media@example.test',
  initials: 'MT',
  roleKey: 'media',
  role: '媒介账号',
  scopeName: '赖丽红',
};

const request = (id: string, lifecycle: RequestProjectSummary['lifecycle']): RequestProjectSummary => ({
  id,
  paymentRequestProjectId: `${id}-internal` as RequestProjectSummary['paymentRequestProjectId'],
  requestCode: `REQ-${id}`,
  lifecycle,
  project: `Project ${id}`,
  brand: 'Test Brand',
  media: '赖丽红',
  pm: 'Test PM',
  amount: 'USD 100',
  contracts: 1,
  invoices: 1,
  paymentOrder: `PAY-${id}`,
  status: lifecycle === 'COMPLETED' ? '已完成' : '审批中',
  filter: lifecycle === 'COMPLETED' ? 'processed' : 'pending',
});

const item = (id: string, provider: 'Airwallex' | 'PayPal', invoiceNumber: string): PaymentListItem => ({
  id,
  engagementId: `${id}-engagement` as PaymentListItem['engagementId'],
  invoiceId: `${id}-invoice` as PaymentListItem['invoiceId'],
  snapshot: {
    invoiceNumber,
    creatorName: 'Creator',
    currency: 'USD',
    receiveCurrency: 'USD',
    amount: 100,
    provider,
    accountSummary: 'Test account',
    paymentReason: 'Campaign',
    transactionReference: 'TEST-REF',
    description: '',
  },
  overrides: {},
});

const paymentList = (
  target: RequestProjectSummary,
  status: PaymentListRecord['status'],
  items: PaymentListItem[],
): PaymentListRecord => ({
  paymentListId: `${target.id}-${status}` as PaymentListRecord['paymentListId'],
  paymentListCode: `PAY-${target.id}`,
  projectId: `${target.id}-project` as PaymentListRecord['projectId'],
  paymentRequestProjectId: target.paymentRequestProjectId,
  provider: 'Airwallex',
  status,
  items,
  createdAt: '2026-08-09T09:00:00.000Z',
  updatedAt: '2026-08-09T09:00:00.000Z',
});

const resourceActions = {
  onChangeLinks: vi.fn(),
  onOpenContract: vi.fn(),
  onOpenInvoice: vi.fn(),
  onGenerateContract: vi.fn(),
  onGenerateInvoice: vi.fn(),
  onUploadContract: vi.fn(),
  onDeleteContract: vi.fn(),
  onDeleteInvoice: vi.fn(),
  onClearPaymentLists: vi.fn(),
  onRemovePaymentInvoice: vi.fn(),
  onUpdatePaymentItem: vi.fn(),
  onChangePaymentAccount: vi.fn(),
  onRevalidatePaymentItem: vi.fn(),
  onBeginEditPaymentList: vi.fn(),
  onGeneratePaymentListVersion: vi.fn(),
  onExportPaymentList: vi.fn(),
};

describe('media project payment confirmation export', () => {
  it('collects only paid items whose effective provider is Airwallex', () => {
    const completed = request('COMPLETED', 'COMPLETED');
    const paid = paymentList(completed, 'paid', [
      item('airwallex', 'Airwallex', 'INV-AIRWALLEX'),
      item('paypal', 'PayPal', 'INV-PAYPAL'),
    ]);
    const submitted = paymentList(completed, 'submitted', [
      item('pending', 'Airwallex', 'INV-PENDING'),
    ]);

    expect(mediaConfirmationItemsFor(completed, [paid, submitted])).toEqual([{
      paymentListCode: 'PAY-COMPLETED',
      invoiceNumber: 'INV-AIRWALLEX',
    }]);
  });

  it('creates a project ZIP with payment-list and Invoice numbers in every filename', async () => {
    const source = new Uint8Array([37, 80, 68, 70, 45, 77, 69, 68, 73, 65]);
    const archiveBlob = await createMediaConfirmationArchive('REQ-TEST', [
      { paymentListCode: 'PAY-ONE', invoiceNumber: 'INV-001' },
      { paymentListCode: 'PAY-TWO', invoiceNumber: 'INV-002' },
    ], vi.fn(async () => new Blob([source], { type: 'application/pdf' })));
    const archive = await JSZip.loadAsync(await archiveBlob.arrayBuffer());
    const files = Object.keys(archive.files).filter((name) => name.endsWith('.pdf'));

    expect(files).toHaveLength(2);
    expect(files[0]).toContain('PAY-ONE-INV-001');
    expect(files[1]).toContain('PAY-TWO-INV-002');
    await Promise.all(files.map(async (file) => {
      expect(await archive.file(file)?.async('uint8array')).toEqual(source);
    }));
  });

  it('shows exports only for the media owner completed projects and explains disabled rows', () => {
    const eligible = request('ELIGIBLE', 'COMPLETED');
    const empty = request('EMPTY', 'COMPLETED');
    const active = request('ACTIVE', 'SUBMITTED');
    const html = renderToStaticMarkup(
      <MediaPaymentProjectsPage
        notify={vi.fn()}
        currentUser={mediaUser}
        cooperationProjects={[]}
        creators={[]}
        contracts={[]}
        invoices={[]}
        paymentLists={[paymentList(eligible, 'paid', [item('eligible', 'Airwallex', 'INV-ELIGIBLE')])]}
        requests={[eligible, empty, active]}
        canCreate={false}
        focusedProjectId={null}
        onFocusCleared={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onGeneratePaymentList={vi.fn()}
        onSubmitRequest={vi.fn()}
        resourceActions={resourceActions}
      />,
    );

    expect(html.match(/导出确认函/g)).toHaveLength(2);
    expect(html).toContain('无已付款 Airwallex 明细');
    expect(html).toContain('title="没有已付款的 Airwallex 付款明细"');
    expect(html).not.toContain('REQ-ACTIVE</strong><small');
  });

  it('does not expose the media export action to finance viewers', () => {
    const completed = request('FINANCE', 'COMPLETED');
    const html = renderToStaticMarkup(
      <MediaPaymentProjectsPage
        notify={vi.fn()}
        currentUser={{ ...mediaUser, roleKey: 'finance', role: '财务账号' }}
        cooperationProjects={[]}
        creators={[]}
        contracts={[]}
        invoices={[]}
        paymentLists={[paymentList(completed, 'paid', [item('finance', 'Airwallex', 'INV-FINANCE')])]}
        requests={[completed]}
        canCreate={false}
        focusedProjectId={null}
        onFocusCleared={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onGeneratePaymentList={vi.fn()}
        onSubmitRequest={vi.fn()}
        resourceActions={resourceActions}
      />,
    );

    expect(html).not.toContain('导出确认函');
  });
});
