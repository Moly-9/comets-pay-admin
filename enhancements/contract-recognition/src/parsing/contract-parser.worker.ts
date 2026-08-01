/// <reference lib="webworker" />

import type {
  FileParseInput,
  ParsedDocument,
  WorkerParseRequest,
  WorkerParseResponse,
} from "../types";
import { ContractParseError } from "./errors";
import { parseDocx } from "./docxParser";
import { parsePdf } from "./pdfParser";

const workerScope = self as DedicatedWorkerGlobalScope;

const send = (response: WorkerParseResponse) => workerScope.postMessage(response);

const isPdf = (file: FileParseInput) =>
  file.name.toLocaleLowerCase().endsWith(".pdf") ||
  file.mimeType === "application/pdf";

const parseOne = async (
  file: FileParseInput,
): Promise<ParsedDocument> => {
  try {
    send({
      type: "progress",
      payload: {
        fileId: file.id,
        fileName: file.name,
        phase: "parsing",
        progress: 8,
        message: "正在读取文件结构",
      },
    });
    const document = isPdf(file)
      ? await parsePdf(file, (current, total) => {
          send({
            type: "progress",
            payload: {
              fileId: file.id,
              fileName: file.name,
              phase: "parsing",
              progress: Math.round(10 + (current / total) * 76),
              message: `正在解析第 ${current} / ${total} 页`,
            },
          });
        })
      : await parseDocx(file);
    send({
      type: "progress",
      payload: {
        fileId: file.id,
        fileName: file.name,
        phase: "complete",
        progress: 100,
        message: "文件解析完成",
      },
    });
    return document;
  } catch (error) {
    const parseError =
      error instanceof ContractParseError
        ? error
        : new ContractParseError("UNKNOWN", "文件解析失败");
    send({
      type: "progress",
      payload: {
        fileId: file.id,
        fileName: file.name,
        phase: "error",
        progress: 100,
        message: parseError.message,
      },
    });
    return {
      id: file.id,
      fileName: file.name,
      fileType: isPdf(file) ? "pdf" : "docx",
      documentType: "UNKNOWN",
      blocks: [],
      textLength: 0,
      status: parseError.code === "SCANNED_PDF" ? "scanned" : "error",
      errorCode: parseError.code,
      errorMessage: parseError.message,
    };
  }
};

workerScope.addEventListener("message", async (event: MessageEvent<WorkerParseRequest>) => {
  if (event.data.type !== "parse") return;
  try {
    const documents: ParsedDocument[] = [];
    for (const file of event.data.files) {
      documents.push(await parseOne(file));
    }
    send({ type: "complete", payload: documents });
  } catch {
    send({
      type: "fatal",
      payload: { message: "解析进程异常终止，请重新选择文件后重试" },
    });
  }
});
