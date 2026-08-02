import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fieldDefinitions } from "../core/fieldDefinitions";
import type {
  ContractRecord,
  FieldKey,
  RecognitionField,
} from "../types";
import { ContractDetail } from "./ContractDetail";

const fields = Object.fromEntries(
  fieldDefinitions.map((definition) => [
    definition.key,
    {
      fieldKey: definition.key,
      label: definition.label,
      rawValue:
        definition.key === "advertiser"
          ? "Comets International Limited"
          : "",
      normalizedValue:
        definition.key === "advertiser"
          ? "Comets International Limited"
          : null,
      source: null,
      confidence: definition.key === "advertiser" ? 0.96 : 0,
      status: definition.key === "advertiser" ? "detected" : "missing",
      candidates: [],
    } satisfies RecognitionField,
  ]),
) as unknown as Record<FieldKey, RecognitionField>;

const contract: ContractRecord = {
  id: "CON-260802-001",
  name: "Nebula Quest",
  ioId: "",
  advertiser: "Comets International Limited",
  publisher: "",
  projectName: "Nebula Quest",
  brandName: "Nebula Quest",
  status: "待确认",
  updatedAt: "2026-08-02 17:00:00",
  sourceNames: [],
  result: {
    documents: [],
    fields,
    recognizedAt: "2026-08-02T09:00:00.000Z",
  },
};

describe("ContractDetail confirmation actions", () => {
  it("confirms parsed content without entering edit mode", () => {
    const onCommitted = vi.fn();
    render(
      <ContractDetail
        contract={contract}
        onBack={vi.fn()}
        onCommitted={onCommitted}
      />,
    );

    expect(
      screen.getByRole("button", { name: "修改解析内容" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "确认解析内容" }),
    );

    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(
      onCommitted.mock.calls[0][0].result.fields.advertiser.status,
    ).toBe("confirmed");
    expect(
      screen.getByRole("button", { name: "已确认解析内容" }),
    ).toBeDisabled();
  });
});
