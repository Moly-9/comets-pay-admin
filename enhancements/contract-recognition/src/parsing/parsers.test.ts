import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { FileParseInput } from "../types";
import { ContractParseError } from "./errors";
import { parseDocx } from "./docxParser";
import { assertPdfHasTextLayer } from "./pdfParser";

const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Campaign Details</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>IO Number: IO-DOCX-01</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Project Total Fees</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>USD 300</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

describe("contract parsers", () => {
  it("extracts DOCX headings, paragraphs, tables and cells", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", docxXml);
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const input: FileParseInput = {
      id: "docx-1",
      name: "campaign-io.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: buffer.byteLength,
      buffer,
    };

    const result = await parseDocx(input);

    expect(result.documentType).toBe("IO");
    expect(result.blocks.some((block) => block.kind === "heading")).toBe(true);
    expect(
      result.blocks.some(
        (block) =>
          block.kind === "table" &&
          block.text === "Project Total Fees | USD 300",
      ),
    ).toBe(true);
    expect(
      result.blocks.filter((block) => block.kind === "tableCell"),
    ).toHaveLength(2);
  });

  it("identifies a PDF without a usable text layer as scanned", () => {
    expect(() => assertPdfHasTextLayer(0)).toThrowError(ContractParseError);
    try {
      assertPdfHasTextLayer(0);
    } catch (error) {
      expect((error as ContractParseError).code).toBe("SCANNED_PDF");
      expect((error as Error).message).toContain("暂不支持自动识别");
    }
  });
});
