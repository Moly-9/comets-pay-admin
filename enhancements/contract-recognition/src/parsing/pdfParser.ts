import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { FileParseInput, ParsedBlock, ParsedDocument } from "../types";
import { detectDocumentType } from "./documentType";
import { ContractParseError } from "./errors";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
if (typeof Worker !== "undefined") {
  GlobalWorkerOptions.workerPort = new Worker(pdfWorkerUrl, {
    type: "module",
    name: "pdfjs-contract-worker",
  });
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEol: boolean;
}

interface TextLine {
  items: PositionedText[];
  y: number;
}

const joinLine = (line: TextLine) => {
  const sorted = [...line.items].sort((left, right) => left.x - right.x);
  let text = "";
  let previous: PositionedText | null = null;
  let largestGap = 0;
  for (const item of sorted) {
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      largestGap = Math.max(largestGap, gap);
      if (gap > 32) text += " | ";
      else if (gap > Math.max(2.2, previous.height * 0.18)) text += " ";
    }
    text += item.text;
    previous = item;
  }
  return {
    text: text.replace(/\s+/g, " ").trim(),
    largestGap,
    sorted,
  };
};

const toLines = (items: PositionedText[]): TextLine[] => {
  const lines: TextLine[] = [];
  for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const tolerance = Math.max(2.5, item.height * 0.35);
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
      line.y =
        line.items.reduce((total, current) => total + current.y, 0) /
        line.items.length;
    } else {
      lines.push({ items: [item], y: item.y });
    }
  }
  return lines.sort((left, right) => right.y - left.y);
};

const lineToBlock = (
  line: TextLine,
  pageNumber: number,
  index: number,
): ParsedBlock | null => {
  const { text, largestGap, sorted } = joinLine(line);
  if (!text) return null;
  const minX = Math.min(...sorted.map((item) => item.x));
  const minY = Math.min(...sorted.map((item) => item.y));
  const maxX = Math.max(...sorted.map((item) => item.x + item.width));
  const maxY = Math.max(...sorted.map((item) => item.y + item.height));
  return {
    id: `pdf-${pageNumber}-${index}`,
    kind: largestGap > 32 && sorted.length > 1 ? "table" : "line",
    text,
    pageNumber,
    coordinates: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
};

export const assertPdfHasTextLayer = (textLength: number) => {
  if (textLength < 8) {
    throw new ContractParseError(
      "SCANNED_PDF",
      "该文件可能是扫描件，暂不支持自动识别，请手动填写",
    );
  }
};

export const parsePdf = async (
  input: FileParseInput,
  onPage?: (current: number, total: number) => void,
): Promise<ParsedDocument> => {
  try {
    const loadingTask = getDocument({
      data: new Uint8Array(input.buffer),
    });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const blocks: ParsedBlock[] = [];
    let textLength = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const positioned = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const transform = item.transform;
        return [
          {
            text: item.str.replace(/[\u0000-\u001f\u007f]+/g, " "),
            x: transform[4],
            y: transform[5],
            width: item.width,
            height: item.height || Math.abs(transform[3]) || 10,
            hasEol: item.hasEOL,
          } satisfies PositionedText,
        ];
      });
      const pageBlocks = toLines(positioned)
        .map((line, index) => lineToBlock(line, pageNumber, index))
        .filter((block): block is ParsedBlock => Boolean(block));
      blocks.push(...pageBlocks);
      textLength += pageBlocks.reduce((total, block) => total + block.text.length, 0);
      onPage?.(pageNumber, pdf.numPages);
    }

    assertPdfHasTextLayer(textLength);
    await pdf.destroy();

    return {
      id: input.id,
      fileName: input.name,
      fileType: "pdf",
      documentType: detectDocumentType(input.name, blocks),
      pageCount,
      blocks,
      textLength,
      status: "parsed",
    };
  } catch (error) {
    if (error instanceof ContractParseError) throw error;
    console.error("[contract-recognition] PDF parse failed", error);
    const errorName = error instanceof Error ? error.name : "";
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (/PasswordException|password/i.test(`${errorName} ${errorMessage}`)) {
      throw new ContractParseError(
        "ENCRYPTED_PDF",
        "PDF 已加密或需要密码，暂时无法解析",
      );
    }
    throw new ContractParseError(
      "CORRUPTED_FILE",
      "PDF 文件损坏或格式不完整，无法解析",
    );
  }
};
