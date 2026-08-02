import { describe, expect, it } from "vitest";
import { validateFiles } from "./fileValidation";

describe("file validation", () => {
  it("rejects empty and unsupported files", () => {
    const emptyPdf = new File([], "empty.pdf", { type: "application/pdf" });
    const image = new File(["image"], "scan.png", { type: "image/png" });

    expect(validateFiles([emptyPdf, image])).toEqual([
      expect.objectContaining({ code: "EMPTY_FILE", fileName: "empty.pdf" }),
      expect.objectContaining({
        code: "UNSUPPORTED_TYPE",
        fileName: "scan.png",
      }),
    ]);
  });
});
