import { describe, expect, it } from "vitest";
import {
  normalizeDateRange,
  normalizeMoney,
  normalizeTransferFee,
} from "./normalizers";

describe("field normalizers", () => {
  it("normalizes an English date range", () => {
    expect(
      normalizeDateRange("August 1, 2026 to August 31, 2026"),
    ).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
  });

  it.each([
    ["300 USD", { amount: 300, currency: "USD" }],
    ["USD 300", { amount: 300, currency: "USD" }],
    ["EUR 1,250.50", { amount: 1250.5, currency: "EUR" }],
  ])("normalizes money in %s", (rawValue, expected) => {
    expect(normalizeMoney(rawValue)).toEqual(expected);
  });

  it("normalizes transfer fee responsibility", () => {
    expect(normalizeTransferFee("All bank fees are borne by Advertiser")).toBe(
      "advertiser",
    );
    expect(normalizeTransferFee("转账手续费由收款方承担")).toBe("publisher");
  });
});
