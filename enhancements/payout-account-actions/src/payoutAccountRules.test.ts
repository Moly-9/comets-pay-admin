import { describe, expect, it } from "vitest";
import {
  getAvailableDefaultAccounts,
  getDestructiveAccountRule,
  getReenabledStatus,
  type PayoutAccount,
} from "./payoutAccountRules";

const account = (
  overrides: Partial<PayoutAccount> = {},
): PayoutAccount => ({
  id: "account-1",
  provider: "Airwallex",
  nickname: "测试账户",
  isDefault: false,
  status: "DRAFT",
  ...overrides,
});

describe("payout account lifecycle rules", () => {
  it("allows unlinked incomplete accounts to be deleted", () => {
    expect(getDestructiveAccountRule(account())).toEqual({
      action: "delete",
      blocked: false,
    });
  });

  it("retains verified accounts and accounts with history", () => {
    expect(
      getDestructiveAccountRule(
        account({ status: "VERIFIED", beneficiaryId: "bene_1" }),
      ).action,
    ).toBe("disable");
    expect(
      getDestructiveAccountRule(account({ invoiceIds: ["INV-1"] })).action,
    ).toBe("disable");
  });

  it("blocks destructive actions while an account is processing", () => {
    expect(
      getDestructiveAccountRule(account({ status: "PAYMENT_PROCESSING" })),
    ).toEqual({
      action: "disable",
      blocked: true,
      reason: "该账户正在处理中，完成后才能停用。",
    });
  });

  it("only offers payment-ready accounts as default replacements", () => {
    const ready = account({ id: "ready", status: "VERIFIED" });
    const pending = account({
      id: "pending",
      provider: "PayPal",
      status: "READY_FOR_VALIDATION",
    });
    const disabled = account({ id: "disabled", status: "DISABLED" });

    expect(
      getAvailableDefaultAccounts([ready, pending, disabled]).map(
        (item) => item.id,
      ),
    ).toEqual(["ready"]);
  });

  it("restores the previous status when reenabled", () => {
    expect(
      getReenabledStatus(
        account({
          status: "DISABLED",
          __statusBeforeDisabled: "VERIFIED",
        }),
      ),
    ).toBe("VERIFIED");
  });
});
