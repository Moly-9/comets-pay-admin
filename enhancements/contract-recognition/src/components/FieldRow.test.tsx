import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { RecognitionField } from "../types";
import { FieldRow } from "./FieldRow";

const initialField: RecognitionField = {
  fieldKey: "paymentMethod",
  label: "Payment Method",
  rawValue: "",
  normalizedValue: null,
  source: null,
  confidence: 0,
  status: "missing",
  candidates: [],
};

function Harness() {
  const [field, setField] = useState(initialField);
  return (
    <FieldRow field={field} onChange={setField} onLocate={() => undefined} />
  );
}

describe("FieldRow", () => {
  it("lets the user edit and explicitly confirm a detected field", () => {
    const { container } = render(<Harness />);
    fireEvent.change(screen.getByLabelText("Payment Method"), {
      target: { value: "PayPal" },
    });
    expect(container.querySelector(".cr-status-detected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(container.querySelector(".cr-status-confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment Method")).toHaveValue("PayPal");
  });
});
