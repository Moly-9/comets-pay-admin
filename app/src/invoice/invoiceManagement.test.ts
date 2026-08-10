import { describe, expect, it } from 'vitest';
import type { RequestApprovalState } from '../businessWorkflow';
import type { PaymentRequestProjectLike } from '../paymentRequestProjects';
import type { Payout } from '../types';
import { getInvoiceManagementView } from './invoiceManagement';

const payout = (invoiceReviewStatus: Payout['invoiceReviewStatus'], status: Payout['status'] = '未进入付款') => ({
  invoiceReviewStatus,
  status,
});

const request = (
  status: RequestApprovalState['status'],
  lifecycle: PaymentRequestProjectLike['lifecycle'] = 'SUBMITTED',
): PaymentRequestProjectLike => ({
  id: 'request-test',
  lifecycle,
  approval: {
    status,
    round: 1,
    history: [],
    submittedAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
});

describe('Invoice management presentation', () => {
  it('uses four page groups without an approval tab', () => {
    expect(getInvoiceManagementView(payout('待签署'))).toMatchObject({ tab: 'signature', status: '待签署' });
    expect(getInvoiceManagementView(payout('待媒介审核'))).toMatchObject({ tab: 'review', status: '待审核' });
    expect(getInvoiceManagementView(payout('待发起请款'))).toMatchObject({ tab: 'approved', status: '待发起请款' });
    expect(getInvoiceManagementView(payout('已退回'))).toMatchObject({ tab: 'returned', status: '已退回' });
  });

  it.each(['PENDING_PM', 'PENDING_PROJECT_OWNER', 'PENDING_OWNER', 'PENDING_FINANCE'] as const)(
    'presents %s as OA approval in the approved tab',
    (status) => {
      expect(getInvoiceManagementView(payout('待发起请款'), request(status))).toMatchObject({
        tab: 'approved',
        status: 'OA审批中',
      });
    },
  );

  it('presents payment and paid states after project approval', () => {
    expect(getInvoiceManagementView(payout('已通过', '等待付款'), request('APPROVED', 'APPROVED')).status).toBe('付款中');
    expect(getInvoiceManagementView(payout('已通过', '已付款'), request('APPROVED', 'COMPLETED')).status).toBe('已付款');
  });

  it('places a returned request in the returned tab without changing document status', () => {
    expect(getInvoiceManagementView(
      payout('待发起请款'),
      request('RETURNED_TO_MEDIA_REVIEW', 'RETURNED'),
    )).toMatchObject({ tab: 'returned', status: '已退回' });
  });

  it('shows a changed returned-project Invoice in its new signature workflow', () => {
    expect(getInvoiceManagementView(
      payout('待签署'),
      request('RETURNED_TO_MEDIA_REVIEW', 'RETURNED'),
    )).toMatchObject({ tab: 'signature', status: '待签署' });
  });
});
