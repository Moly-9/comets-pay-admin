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
    paymentDetails: {
      bankCountry: 'United States',
      accountName: 'Review Creator',
      accountType: 'Checking',
      swiftCode: '',
      accountNumber: '00001234',
      iban: '',
      beneficiaryType: 'PERSONAL',
      bankName: 'Review Bank',
      bankStreetAddress: '100 Review Street',
      bankCity: 'New York',
      bankState: 'New York',
      bankPostalCode: '10001',
      intermediaryBankCountry: '',
      intermediaryBankCode: '',
      transferRemarks: '',
      paypalUsername: '',
      paypalEmail: '',
      payoutAccountId: account.id,
      payoutAccountVersion: getPayoutAccountVersion(account),
      payoutProvider: 'Airwallex',
      accountFingerprint: getPayoutAccountFingerprint(account),
      transferMethod: account.transferMethod,
      localClearingSystem: account.bankDetails.localClearingSystem,
      accountCurrency: account.bankDetails.accountCurrency,
      validationStatus: account.status,
    },
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

  it('flags missing frozen bank fields before the API button is used', () => {
    const incompleteItem: PaymentListItem = {
      ...item,
      snapshot: {
        ...item.snapshot,
        paymentDetails: { ...item.snapshot.paymentDetails!, accountNumber: '' },
      },
    };
    expect(reviewPaymentListAccountSnapshot(incompleteItem, [creator])).toEqual({
      state: 'attention',
      issues: expect.arrayContaining(['付款清单缺少 Account Number']),
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
      message: 'Airwallex 付款信息完整性校验通过，收款账户字段完整',
      checkedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(requestMock.mock.calls.map(([input]) => String(input))).toEqual([
      AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
      AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH,
    ]);
  });

  it('blocks an incomplete frozen payment-list snapshot even when the profile account is complete', async () => {
    const incompleteItem: PaymentListItem = {
      ...item,
      snapshot: {
        ...item.snapshot,
        paymentDetails: { ...item.snapshot.paymentDetails!, accountNumber: '' },
      },
    };
    const requiredAccountNumberSchema: AirwallexFormSchemaResponse = {
      ...schema,
      fields: [{
        enabled: true,
        field: {
          key: 'account_number',
          label: '银行账号',
          type: 'INPUT',
          default: '',
          description: '',
          example: '',
          placeholder: '',
          refresh: false,
          tip: '',
        },
        path: 'beneficiary.bank_details.account_number',
        required: true,
        rule: { type: 'string' },
      }],
    };
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(requiredAccountNumberSchema);
      if (String(input) === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return jsonResponse({});
      return new Response('', { status: 404 });
    });

    await expect(validatePaymentListAccountViaApi({
      item: incompleteItem,
      creators: [creator],
      request: requestMock as unknown as typeof fetch,
    })).resolves.toMatchObject({
      state: 'invalid',
      message: '付款清单冻结快照缺少必填字段：付款清单缺少 Account Number',
    });
    expect(requestMock.mock.calls.map(([input]) => String(input))).toEqual([
      AIRWALLEX_FORM_SCHEMA_PROXY_PATH,
    ]);
  });

  it('uses schema-backed address values from the frozen snapshot', async () => {
    const schemaField = (
      path: string,
      label: string,
    ): AirwallexFormSchemaResponse['fields'][number] => ({
      enabled: true,
      field: {
        key: path.split('.').pop() ?? path,
        label,
        type: 'INPUT',
        default: '',
        description: '',
        example: '',
        placeholder: '',
        refresh: false,
        tip: '',
      },
      path,
      required: true,
      rule: { type: 'string' },
    });
    const schemaBackedItem: PaymentListItem = {
      ...item,
      snapshot: {
        ...item.snapshot,
        paymentDetails: {
          ...item.snapshot.paymentDetails!,
          bankCity: '',
          bankPostalCode: '',
          schemaValues: {
            ...(item.snapshot.paymentDetails?.schemaValues ?? {}),
            'beneficiary.address.city': 'New York',
            'beneficiary.address.postcode': '10001',
          },
          schemaFields: [
            { path: 'beneficiary.address.city', label: '收款人城市', required: true },
            { path: 'beneficiary.address.postcode', label: '收款人邮政编码', required: true },
          ],
        },
      },
    };
    const addressSchema: AirwallexFormSchemaResponse = {
      ...schema,
      fields: [
        schemaField('beneficiary.address.city', '收款人城市'),
        schemaField('beneficiary.address.postcode', '收款人邮政编码'),
      ],
    };
    const requestMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === AIRWALLEX_FORM_SCHEMA_PROXY_PATH) return jsonResponse(addressSchema);
      if (String(input) === AIRWALLEX_BENEFICIARY_VALIDATE_PROXY_PATH) return jsonResponse({});
      return new Response('', { status: 404 });
    });

    await expect(validatePaymentListAccountViaApi({
      item: schemaBackedItem,
      creators: [creator],
      request: requestMock as unknown as typeof fetch,
    })).resolves.toMatchObject({
      state: 'passed',
      message: 'Airwallex 付款信息完整性校验通过，收款账户字段完整',
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
