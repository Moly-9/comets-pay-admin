import {
  AirwallexIntegrationError,
  buildAirwallexBeneficiaryPayload,
  getAirwallexBeneficiaryFormSchema,
  validateAirwallexBeneficiary,
} from './airwallexBeneficiaryApi';
import { validateAirwallexFormSchema } from './airwallexFormSchema';
import {
  paymentListEffectiveAccount,
  type PaymentListItem,
} from './businessWorkflow';
import {
  paymentListAccountForItem,
  paymentListItemAccountIssues,
} from './paymentListWorkbook';
import type { CreatorProfile } from './types';

export type PaymentAccountSnapshotReview = {
  state: 'ready' | 'attention' | 'unsupported';
  issues: string[];
};

export type PaymentAccountApiValidation = {
  state: 'passed' | 'invalid' | 'unavailable';
  message: string;
  checkedAt?: string;
};

export const reviewPaymentListAccountSnapshot = (
  item: PaymentListItem,
  creators: CreatorProfile[],
): PaymentAccountSnapshotReview => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  if (effectiveAccount.provider !== 'Airwallex') {
    return {
      state: 'unsupported',
      issues: [`当前原型未接入 ${effectiveAccount.provider || '该渠道'} 收款账户校验 API`],
    };
  }
  const account = paymentListAccountForItem(item, creators);
  const issues = paymentListItemAccountIssues(item, account);
  return { state: issues.length ? 'attention' : 'ready', issues };
};

export const validatePaymentListAccountViaApi = async ({
  item,
  creators,
  request = fetch,
  now = () => new Date().toISOString(),
}: {
  item: PaymentListItem;
  creators: CreatorProfile[];
  request?: typeof fetch;
  now?: () => string;
}): Promise<PaymentAccountApiValidation> => {
  const effectiveAccount = paymentListEffectiveAccount(item);
  if (effectiveAccount.provider !== 'Airwallex') {
    return {
      state: 'unavailable',
      message: `当前原型未接入 ${effectiveAccount.provider || '该渠道'} 收款账户校验 API`,
    };
  }
  const account = paymentListAccountForItem(item, creators);
  if (!account) {
    return {
      state: 'invalid',
      message: '达人档案中未找到付款清单引用的 Airwallex 收款账户',
    };
  }

  try {
    const schema = await getAirwallexBeneficiaryFormSchema(account, request);
    const fieldIssues = validateAirwallexFormSchema(account, schema);
    if (fieldIssues.length) {
      return {
        state: 'invalid',
        message: `收款账户缺少 API 必填字段：${fieldIssues.map((issue) => issue.message).join('、')}`,
      };
    }
    await validateAirwallexBeneficiary(
      buildAirwallexBeneficiaryPayload(account, schema),
      request,
    );
    return {
      state: 'passed',
      message: 'Airwallex API 已确认收款账户字段完整',
      checkedAt: now(),
    };
  } catch (error) {
    if (error instanceof AirwallexIntegrationError && error.fieldIssues?.length) {
      return {
        state: 'invalid',
        message: error.fieldIssues.map((issue) => issue.message).join('、'),
      };
    }
    return {
      state: 'unavailable',
      message: error instanceof Error ? error.message : '收款账户校验 API 暂不可用',
    };
  }
};
