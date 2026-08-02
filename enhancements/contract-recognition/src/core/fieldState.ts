import type { FieldKey, RecognitionField } from "../types";
import {
  normalizeDate,
  normalizeDateRange,
  normalizeDays,
  normalizeMoney,
  normalizePaymentMethod,
  normalizeTransferFee,
} from "./normalizers";

const normalizeEditedValue = (fieldKey: FieldKey, value: string): unknown => {
  if (fieldKey === "projectBrand") {
    const [projectName = "", brandName = ""] = value
      .split(/\s*(?:\/|·)\s*/, 2)
      .map((item) => item.trim());
    return { projectName, brandName };
  }
  if (fieldKey === "platformChannel") {
    const parts = value.split(/\s*·\s*/).map((item) => item.trim());
    return {
      platform: parts[0] ?? "",
      channelName: parts[1] ?? "",
      handle: parts.find((item) => item.startsWith("@")) ?? "",
      channelUrl: parts.find((item) => /^https?:\/\//i.test(item)) ?? "",
    };
  }
  if (fieldKey === "effectiveDate") return normalizeDate(value) ?? value;
  if (fieldKey === "campaignPeriod") return normalizeDateRange(value) ?? value;
  if (fieldKey === "projectTotalFees") return normalizeMoney(value) ?? value;
  if (fieldKey === "paymentTerm") {
    return { description: value, normalizedDays: normalizeDays(value) };
  }
  if (fieldKey === "invoiceIssuePeriod") {
    return {
      description: value,
      date: normalizeDate(value),
      normalizedDays: normalizeDays(value),
    };
  }
  if (fieldKey === "paymentMethod") {
    return normalizePaymentMethod(value) ?? value;
  }
  if (fieldKey === "transferFee") {
    return normalizeTransferFee(value) ?? value;
  }
  if (fieldKey === "beneficiaryAccount") return { snapshot: value };
  return value;
};

export const editRecognitionField = (
  field: RecognitionField,
  value: string,
): RecognitionField => ({
  ...field,
  rawValue: value,
  normalizedValue: normalizeEditedValue(field.fieldKey, value),
  editedValue: value,
  confidence: 1,
  status: value.trim() ? "detected" : "missing",
  source: field.source,
});

export const confirmRecognitionField = (
  field: RecognitionField,
): RecognitionField => {
  if (!field.rawValue.trim()) return { ...field, status: "missing" };
  return { ...field, status: "confirmed" };
};

export const allFieldsConfirmed = (
  fields: Record<FieldKey, RecognitionField>,
) => Object.values(fields).every((field) => field.status === "confirmed");

export const confirmPopulatedFields = (
  fields: Record<FieldKey, RecognitionField>,
): Record<FieldKey, RecognitionField> =>
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      confirmRecognitionField(field),
    ]),
  ) as Record<FieldKey, RecognitionField>;
