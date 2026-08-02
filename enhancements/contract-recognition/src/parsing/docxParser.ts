import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { FileParseInput, ParsedBlock, ParsedDocument } from "../types";
import { detectDocumentType } from "./documentType";
import { ContractParseError } from "./errors";

type OrderedNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: false,
});

const children = (node: OrderedNode, key: string): OrderedNode[] => {
  const value = node[key];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
};

const firstNode = (
  nodes: OrderedNode[],
  key: string,
): OrderedNode | undefined => nodes.find((node) => key in node);

const nodeAttribute = (node: OrderedNode, name: string): string => {
  const attributes = node[":@"];
  if (!attributes || typeof attributes !== "object") return "";
  const value = (attributes as Record<string, unknown>)[`@_${name}`];
  return typeof value === "string" ? value : "";
};

const textContent = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (!value || typeof value !== "object") return "";
  const node = value as OrderedNode;
  if (typeof node["#text"] === "string") return node["#text"];
  let text = "";
  for (const [key, item] of Object.entries(node)) {
    if (key === ":@" || key === "#text") continue;
    if (key === "w:tab") text += "\t";
    else if (key === "w:br" || key === "w:cr") text += "\n";
    else text += textContent(item);
  }
  return text;
};

const paragraphStyle = (paragraph: OrderedNode): string => {
  const properties = firstNode(children(paragraph, "w:p"), "w:pPr");
  if (!properties) return "";
  const style = firstNode(children(properties, "w:pPr"), "w:pStyle");
  return style ? nodeAttribute(style, "w:val") : "";
};

const paragraphText = (paragraph: OrderedNode) =>
  textContent(children(paragraph, "w:p")).replace(/[ \t]+/g, " ").trim();

const tableRows = (table: OrderedNode): OrderedNode[][] => {
  const rows = children(table, "w:tbl").filter((node) => "w:tr" in node);
  return rows.map((row) =>
    children(row, "w:tr").filter((node) => "w:tc" in node),
  );
};

export const parseDocx = async (
  input: FileParseInput,
): Promise<ParsedDocument> => {
  try {
    const zip = await JSZip.loadAsync(input.buffer);
    const documentFile = zip.file("word/document.xml");
    if (!documentFile) {
      throw new ContractParseError(
        "DOCX_CONTENT_MISSING",
        "DOCX 中缺少正文内容，无法解析",
      );
    }
    const xml = await documentFile.async("string");
    const tree = parser.parse(xml) as OrderedNode[];
    const documentNode = firstNode(tree, "w:document");
    const bodyNode = documentNode
      ? firstNode(children(documentNode, "w:document"), "w:body")
      : undefined;
    if (!bodyNode) {
      throw new ContractParseError(
        "DOCX_CONTENT_MISSING",
        "DOCX 正文结构不完整，无法解析",
      );
    }

    const blocks: ParsedBlock[] = [];
    let paragraphIndex = 0;
    let section = "";
    for (const node of children(bodyNode, "w:body")) {
      if ("w:p" in node) {
        const text = paragraphText(node);
        if (!text) continue;
        paragraphIndex += 1;
        const style = paragraphStyle(node);
        const isHeading =
          /heading|title|标题/i.test(style) ||
          (text.length < 90 && /^[A-Z][A-Z\s/&-]{5,}$/.test(text));
        if (isHeading) section = text;
        blocks.push({
          id: `docx-p-${paragraphIndex}`,
          kind: isHeading ? "heading" : "paragraph",
          text,
          paragraphIndex,
          section: section || undefined,
        });
      }

      if ("w:tbl" in node) {
        const rows = tableRows(node);
        rows.forEach((cells, rowIndex) => {
          const cellTexts = cells.map((cell) =>
            textContent(children(cell, "w:tc")).replace(/\s+/g, " ").trim(),
          );
          const rowText = cellTexts.filter(Boolean).join(" | ");
          if (!rowText) return;
          paragraphIndex += 1;
          blocks.push({
            id: `docx-table-${paragraphIndex}`,
            kind: "table",
            text: rowText,
            paragraphIndex,
            section: section || undefined,
            rowIndex,
          });
          cellTexts.forEach((text, columnIndex) => {
            if (!text) return;
            blocks.push({
              id: `docx-cell-${paragraphIndex}-${columnIndex}`,
              kind: "tableCell",
              text,
              paragraphIndex,
              section: section || undefined,
              rowIndex,
              columnIndex,
            });
          });
        });
      }
    }

    const textLength = blocks.reduce((total, block) => total + block.text.length, 0);
    if (!textLength) {
      throw new ContractParseError(
        "DOCX_CONTENT_MISSING",
        "DOCX 正文为空，请检查文件内容",
      );
    }
    return {
      id: input.id,
      fileName: input.name,
      fileType: "docx",
      documentType: detectDocumentType(input.name, blocks),
      blocks,
      textLength,
      status: "parsed",
    };
  } catch (error) {
    if (error instanceof ContractParseError) throw error;
    throw new ContractParseError(
      "CORRUPTED_FILE",
      "DOCX 文件损坏或不是标准 Office Open XML 文件",
    );
  }
};
