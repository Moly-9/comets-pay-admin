import { describe, expect, it } from "vitest";
import type { RecognitionField } from "../types";
import {
  confirmPopulatedFields,
  confirmRecognitionField,
  editRecognitionField,
} from "./fieldState";

const missingField: RecognitionField = {
  fieldKey: "paymentTerm",
  label: "Payment Term",
  rawValue: "",
  normalizedValue: null,
  source: null,
  confidence: 0,
  status: "missing",
  candidates: [],
};

const source = {
  documentType: "IO" as const,
  fileName: "campaign-io.docx",
  paragraphIndex: 15,
  sourceText: "Payment Term: Net 45",
};

describe("recognition field state", () => {
  it("updates an edited field and confirms it explicitly", () => {
    const edited = editRecognitionField(missingField, "Net 30");
    expect(edited.status).toBe("detected");
    expect(edited.normalizedValue).toEqual({
      description: "Net 30",
      normalizedDays: 30,
    });

    const confirmed = confirmRecognitionField(edited);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.rawValue).toBe("Net 30");
  });

  it("does not confirm an empty field", () => {
    expect(confirmRecognitionField(missingField).status).toBe("missing");
  });

  it("preserves the original source while a parsed value is edited", () => {
    const edited = editRecognitionField(
      { ...missingField, source },
      "Net 45",
    );
    expect(edited.source).toEqual(source);
  });

  it("confirms all populated fields while leaving missing fields unresolved", () => {
    const populated = editRecognitionField(missingField, "Net 30");
    const fields = {
      paymentTerm: populated,
      paymentMethod: {
        ...missingField,
        fieldKey: "paymentMethod" as const,
        label: "Payment Method",
      },
    } as never;
    const confirmed = confirmPopulatedFields(fields);
    expect(confirmed.paymentTerm.status).toBe("confirmed");
    expect(confirmed.paymentMethod.status).toBe("missing");
  });
});
