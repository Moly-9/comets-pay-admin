import { describe, expect, it, vi } from 'vitest';
import {
  AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
} from './airwallexBeneficiaryApi';
import {
  AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
  type AirwallexFormSchemaResponse,
} from './airwallexFormSchema';
import type { PaymentListItem } from './businessWorkflow';
import {
  getPayoutAccountFingerprint,
  getPayoutAccountVersion,
  createAirwallexPayoutAccount,
} from './payoutAccounts';
import {
  reviewPaymentListAccountSnapshot,
  validatePaymentListAccountViaApi,
} from './requestPaymentAccountValidation';
import type { CreatorProfile } from './types';

const account = createAirwallexPayoutAccount({
  id: 'review-account',
  nickname: '审批校验账户',
  status: 'VALIDATED',
  beneficiaryId: 'beneficiary-review',
  beneficiaryEnvironment: 'MOCK',
  entityType: 'PERSONAL',
  firstName: 'Review',
  lastName: 'Creator',
  address: {
    countryCode: 'US',
    streetAddress: '100 Review Street',
    city: 'New York',
    state: 'New York',
    postcode: '10001',
  },
  transferMethod: 'LOCAL',
  bankDetails: {
    bankCountryCode: 'US',
    bankCountryName: 'United States',
    accountCurrency: 'USD',
    accountName: 'Review Creator',
    accountNumber: '00001234',
    accountRoutingType1: 'aba',
    accountRoutingValue1: '021000021',
    localClearingSystem: 'ACH',
  },
});

const creator: CreatorProfile = {
  id: 'creator-review',
  initials: 'RC',
  accent: '#64748b',
  name: 'Review Creator',
  handle: '@review',
  region: '美国',
  platform: 'YouTube',
  projects: 1,
  socialAccounts: [],
  contact: {
    legalName: 'Review Creator',
    address: 'Synthetic address',
    phone: '+0 000 000 0000',
    email: 'review@example.test',
  },
  payoutAccounts: [account],
};

const item: PaymentListItem = {
  id: 'payment-review',
  engagementId: 'engagement-review' as PaymentListItem['engagementId'],
  invoiceId: 'invoice-review' as PaymentListItem['invoiceId'],
  snapshot: {
    invoiceNumber: 'INV-REVIEW',
    creatorName: creator.name,
    creatorId: creator.id as PaymentListItem['snapshot']['creatorId'],
    currency: 'USD',
    receiveCurrency: 'USD',
    amount: 1200,
    provider: 'Airwallex',
    accountSummary: '•••• 1234',
    paymentReason: '影音服务',
    transactionReference: 'REQ-REVIEW',
    description: '',
    payoutAccountId: account.id,
    payoutAccountVersion: getPayoutAccountVersion(account),
    externalBeneficiaryId: account.beneficiaryId,
    transferMethod: account.transferMethod,
    localClearingSystem: account.bankDetails.localClearingSystem,
    feeBearer: 'ADVERTISER',
    accountFingerprint: getPayoutAccountFingerprint(account),
    validationStatus: account.status,
  },
  overrides: {},
  requiresRevalidation: false,
};

const schema: AirwallexFormSchemaResponse = {
  condition: {
    type: 'BANK_ACCOUNT',
    bank_country_code: 'US',
    account_currency: 'USD',
    transfer_method: 'LOCAL',
    local_clearing_system: 'ACH',
    entity_type: 'PERSONAL',
    country_code: 'US',
  },
  fields: [],
};

const jsonResponse = (body: unknown) => new Response(
  JSON.stringify(body),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

describe('request payment account validation', () => {
  it('reports a complete immutable account snapshot before API validation', () => {
    expect(reviewPaymentListAccountSnapshot(item, [creator])).toEqual({
      state: 'ready',
      issues: [],
    });
  });

  it('runs the schema and validate-only API calls without saving the beneficiary', async () => {
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(schema);
      if (String(input) === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return jsonResponse({});
      return new Response('', { status: 404 });
    });
    const request = requestMock as unknown as typeof fetch;

    await expect(validatePaymentListAccountViaApi({
      item,
      creators: [creator],
      request,
      now: () => '2026-08-09T00:00:00.000Z',
    })).resolves.toEqual({
      state: 'passed',
      message: 'Airwallex API 已确认收款账户字段完整',
      checkedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(requestMock.mock.calls.map(([input]) => String(input))).toEqual([
      AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
      AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
    ]);
  });

  it('shows an unavailable reminder when the static prototype has no JSON API proxy', async () => {
    const request = vi.fn(async () => new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })) as unknown as typeof fetch;

    await expect(validatePaymentListAccountViaApi({
      item,
      creators: [creator],
      request,
    })).resolves.toEqual({
      state: 'unavailable',
      message: 'Airwallex 服务端代理未配置或返回了非 JSON 响应',
    });
  });

  it('does not call Airwallex for an unsupported payment channel', async () => {
    const request = vi.fn() as unknown as typeof fetch;
    const paypalItem = {
      ...item,
      snapshot: {
        ...item.snapshot,
        provider: 'PayPal' as const,
        transferMethod: 'PAYPAL' as const,
      },
    };

    expect(reviewPaymentListAccountSnapshot(paypalItem, [creator])).toEqual({
      state: 'unsupported',
      issues: ['当前原型未接入 PayPal 收款账户校验 API'],
    });
    await expect(validatePaymentListAccountViaApi({
      item: paypalItem,
      creators: [creator],
      request,
    })).resolves.toEqual({
      state: 'unavailable',
      message: '当前原型未接入 PayPal 收款账户校验 API',
    });
    expect(request).not.toHaveBeenCalled();
  });
});
