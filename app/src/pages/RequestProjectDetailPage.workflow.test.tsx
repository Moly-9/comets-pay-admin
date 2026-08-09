import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_SYSTEM_USERS } from '../data';
import { RequestProjectDetailPage, type RequestProjectSummary } from './RequestProjectDetailPage';

const finance = DEMO_SYSTEM_USERS.find((user) => user.roleKey === 'finance')!;

const request = (status: NonNullable<RequestProjectSummary['approval']>['status']): RequestProjectSummary => ({
  id: `request-${status}`,
  requestCode: `REQ-${status}`,
  lifecycle: 'SUBMITTED',
  approval: {
    status,
    round: 1,
    history: [],
    submittedAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
  project: 'Approval Project',
  brand: 'Test Brand',
  media: 'Media',
  pm: 'Assigned PM',
  amount: 'USD 100',
  contracts: 1,
  invoices: 1,
  paymentOrder: 'PAY-TEST',
  status: 'OA审批中',
  filter: 'pending',
});

const renderDetail = (status: NonNullable<RequestProjectSummary['approval']>['status']) => renderToStaticMarkup(
  <RequestProjectDetailPage
    request={request(status)}
    paymentLists={[]}
    creators={[]}
    generatedInvoices={[]}
    currentUser={finance}
    onExportPaymentList={vi.fn()}
    onApprovalAction={vi.fn()}
    onBack={vi.fn()}
    notify={vi.fn()}
  />,
);

describe('RequestProjectDetailPage approval permissions', () => {
  it('lets finance return but not approve a non-finance OA node', () => {
    const html = renderDetail('PENDING_PM');
    expect(html).toContain('退回媒介修改');
    expect(html).not.toContain('<span>审批通过</span>');
  });

  it('shows project approval at the finance node and blocks it without matched data', () => {
    const html = renderDetail('PENDING_FINANCE');
    expect(html).toContain('待财务审批');
    expect(html).not.toContain('老板审批通过');
    expect(html).toContain('退回媒介修改');
    expect(html).toContain('<span>审批通过</span>');
    expect(html).toContain('暂不能通过财务审核');
    expect(html).toContain('disabled=""');
  });
});
