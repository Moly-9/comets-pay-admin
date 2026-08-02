import { describe, expect, it } from "vitest";
import type { DocumentType, ParsedDocument } from "../types";
import { recognizeDocuments } from "./recognition";

const documentFixture = (
  fileName: string,
  documentType: DocumentType,
  lines: string[],
): ParsedDocument => ({
  id: fileName,
  fileName,
  fileType: fileName.endsWith(".docx") ? "docx" : "pdf",
  documentType,
  blocks: lines.map((text, index) => ({
    id: `${fileName}-${index}`,
    kind: "paragraph",
    text,
    pageNumber: fileName.endsWith(".pdf") ? index + 1 : undefined,
    paragraphIndex: fileName.endsWith(".docx") ? index + 1 : undefined,
    section: index < 3 ? "Parties" : "Campaign Details",
  })),
  textLength: lines.join("").length,
  status: "parsed",
});

describe("recognizeDocuments", () => {
  it("extracts Advertiser and Publisher from Standard Terms", () => {
    const result = recognizeDocuments([
      documentFixture("signed-standard-terms.pdf", "STANDARD_TERMS", [
        "Advertiser: Muse Commerce Limited",
        "Publisher: Léa Martin",
      ]),
    ]);

    expect(result.fields.advertiser.rawValue).toBe("Muse Commerce Limited");
    expect(result.fields.publisher.rawValue).toBe("Léa Martin");
    expect(result.fields.advertiser.source?.pageNumber).toBe(1);
    expect(result.fields.publisher.status).toBe("detected");
  });

  it("extracts IO number, project, platform, link and campaign period", () => {
    const result = recognizeDocuments([
      documentFixture("campaign-io.pdf", "IO", [
        "IO Number: IO-2026-0081",
        "Project Name: Nebula Quest France Launch",
        "Brand: Nebula Quest",
        "Publishing Platform: YouTube · LeaPlay FR",
        "Channel Link: https://youtube.com/@LeaPlayFR",
        "Campaign Period: August 1, 2026 to August 31, 2026",
      ]),
    ]);

    expect(result.fields.ioNumber.rawValue).toBe("IO-2026-0081");
    expect(result.fields.projectBrand.normalizedValue).toEqual({
      projectName: "Nebula Quest France Launch",
      brandName: "Nebula Quest",
    });
    expect(result.fields.platformChannel.normalizedValue).toEqual({
      platform: "YouTube",
      channelName: "LeaPlay FR",
      handle: "",
      channelUrl: "https://youtube.com/@LeaPlayFR",
    });
    expect(result.fields.campaignPeriod.normalizedValue).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
  });

  it("keeps the system contract number and marks a file mismatch as conflict", () => {
    const result = recognizeDocuments(
      [
        documentFixture("agreement.pdf", "MAIN_AGREEMENT", [
          "Contract Number: FILE-CON-88",
        ]),
      ],
      { systemContractNumber: "SYS-CON-99" },
    );

    expect(result.fields.contractNumber.status).toBe("conflict");
    expect(result.fields.contractNumber.rawValue).toBe("SYS-CON-99");
    expect(
      result.fields.contractNumber.candidates.map(
        (candidate) => candidate.rawValue,
      ),
    ).toEqual(["SYS-CON-99", "FILE-CON-88"]);
  });

  it("returns every differing payment term as a conflict", () => {
    const result = recognizeDocuments([
      documentFixture("payment-addendum.pdf", "PAYMENT_ADDENDUM", [
        "Payment Term: Net 30",
      ]),
      documentFixture("campaign-io.pdf", "IO", ["Payment Term: Net 45"]),
    ]);

    expect(result.fields.paymentTerm.status).toBe("conflict");
    expect(result.fields.paymentTerm.rawValue).toBe("");
    expect(result.fields.paymentTerm.candidates).toHaveLength(2);
    expect(result.fields.paymentTerm.candidates[0].source.documentType).toBe(
      "PAYMENT_ADDENDUM",
    );
  });

  it("does not promote a signature date to effective date", () => {
    const result = recognizeDocuments([
      documentFixture("signature-page.pdf", "SIGNATURE_PAGE", [
        "Signature Date: August 2, 2026",
      ]),
    ]);

    expect(result.fields.effectiveDate.status).toBe("missing");
    expect(result.fields.effectiveDate.rawValue).toBe("");
    expect(result.fields.effectiveDate.candidates[0].normalizedValue).toBe(
      "2026-08-02",
    );
  });

  it("does not invent values when fields are absent", () => {
    const result = recognizeDocuments([
      documentFixture("notes.docx", "UNKNOWN", [
        "This document contains general cooperation notes only.",
      ]),
    ]);

    expect(
      Object.values(result.fields).every(
        (field) => field.status === "missing" && field.rawValue === "",
      ),
    ).toBe(true);
  });

  it("does not treat a section heading or template placeholder as a value", () => {
    const document = documentFixture("standard-terms.docx", "STANDARD_TERMS", [
      "Campaign Details",
      "Advertiser: [Please fill in company name]",
      "Project Name: Nebula Quest Launch",
      "Brand: Nebula Quest",
    ]);
    document.blocks[0].kind = "heading";

    const result = recognizeDocuments([document]);

    expect(result.fields.advertiser.status).toBe("missing");
    expect(result.fields.projectBrand.status).toBe("detected");
    expect(result.fields.projectBrand.normalizedValue).toEqual({
      projectName: "Nebula Quest Launch",
      brandName: "Nebula Quest",
    });
  });
});
