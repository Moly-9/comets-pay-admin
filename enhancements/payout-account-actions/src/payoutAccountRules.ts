export type PayoutProvider = "Airwallex" | "PayPal";

export type PayoutAccount = {
  id: string;
  provider: PayoutProvider;
  nickname: string;
  isDefault: boolean;
  status: string;
  beneficiaryId?: string;
  paypalEmail?: string;
  paypalUsername?: string;
  bankDetails?: {
    accountCurrency?: string;
    accountNumber?: string;
    iban?: string;
  };
  linkedProjectIds?: string[];
  invoiceIds?: string[];
  paymentBatchIds?: string[];
  transactionIds?: string[];
  activePaymentId?: string;
  hasPaymentHistory?: boolean;
  __statusBeforeDisabled?: string;
};

export type DestructiveAccountRule = {
  action: "delete" | "disable" | "reenable";
  blocked: boolean;
  reason?: string;
};

const DELETABLE_STATUSES = new Set([
  "DRAFT",
  "READY_FOR_VALIDATION",
  "REVIEW_REQUIRED",
  "INVALID",
  "PENDING_CONFIRMATION",
]);

const PROCESSING_STATUSES = new Set([
  "PROCESSING",
  "UNDER_REVIEW",
  "VALIDATING",
  "VERIFYING",
  "PAYMENT_PROCESSING",
  "PAYOUT_PENDING",
]);

const PAYMENT_READY_STATUSES = new Set(["VALIDATED", "VERIFIED"]);

export const isAccountProcessing = (account: PayoutAccount) =>
  PROCESSING_STATUSES.has(account.status) || Boolean(account.activePaymentId);

export const isAccountPaymentReady = (account: PayoutAccount) =>
  PAYMENT_READY_STATUSES.has(account.status);

export const hasAccountHistory = (account: PayoutAccount) =>
  Boolean(
    account.beneficiaryId ||
      account.hasPaymentHistory ||
      account.linkedProjectIds?.length ||
      account.invoiceIds?.length ||
      account.paymentBatchIds?.length ||
      account.transactionIds?.length,
  );

export const getDestructiveAccountRule = (
  account: PayoutAccount,
): DestructiveAccountRule => {
  if (account.status === "DISABLED") {
    return { action: "reenable", blocked: false };
  }

  const hasHistory = hasAccountHistory(account);
  const action =
    DELETABLE_STATUSES.has(account.status) && !hasHistory ? "delete" : "disable";

  if (isAccountProcessing(account)) {
    return {
      action,
      blocked: true,
      reason: "该账户正在处理中，完成后才能停用。",
    };
  }

  return { action, blocked: false };
};

export const getAvailableDefaultAccounts = (
  accounts: PayoutAccount[],
  excludedId?: string,
) =>
  accounts.filter(
    (account) =>
      account.id !== excludedId &&
      account.status !== "DISABLED" &&
      !isAccountProcessing(account) &&
      isAccountPaymentReady(account),
  );

export const getReenabledStatus = (account: PayoutAccount) => {
  if (account.__statusBeforeDisabled) return account.__statusBeforeDisabled;
  if (account.beneficiaryId) return "VERIFIED";
  if (account.provider === "PayPal" && account.paypalEmail) {
    return "READY_FOR_VALIDATION";
  }
  return "DRAFT";
};
