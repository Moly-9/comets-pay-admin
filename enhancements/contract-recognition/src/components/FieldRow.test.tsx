import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { RecognitionField } from "../types";
import { FieldRow } from "./FieldRow";

const initialField: RecognitionField = {
  fieldKey: "paymentMethod",
  label: "Payment Method",
  rawValue: "Bank Transfer",
  normalizedValue: "BANK_TRANSFER",
  source: {
    documentType: "IO",
    fileName: "campaign-io.docx",
    paragraphIndex: 16,
    section: "Payment",
    sourceText: "Payment Method: Bank Transfer",
  },
  confidence: 0.95,
  status: "detected",
  candidates: [],
};

function Harness({ editing }: { editing: boolean }) {
  const [field, setField] = useState(initialField);
  return (
    <dl>
      <FieldRow
        editing={editing}
        field={field}
        onChange={setField}
        onLocate={() => undefined}
      />
    </dl>
  );
}

describe("FieldRow", () => {
  it("shows parsed content as a compact read-only field by default", () => {
    render(<Harness editing={false} />);
    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IO · 第16段" })).toBeInTheDocument();
  });

  it("allows editing only after the parent enters edit mode", () => {
    render(<Harness editing />);
    const input = screen.getByLabelText("Payment Method");
    fireEvent.change(input, { target: { value: "PayPal" } });
    expect(input).toHaveValue("PayPal");
    expect(screen.getByText("待确认")).toBeInTheDocument();
  });
});
