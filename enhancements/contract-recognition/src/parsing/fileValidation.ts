import type { ParseErrorCode } from "../types";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_FILES = 8;

export interface FileValidationIssue {
  fileName: string;
  code: ParseErrorCode;
  message: string;
}

export const fileKind = (file: Pick<File, "name" | "type">) => {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (
    extension === "docx" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return null;
};

export const validateFiles = (files: File[]): FileValidationIssue[] => {
  const issues: FileValidationIssue[] = [];
  if (files.length > MAX_FILES) {
    issues.push({
      fileName: "全部文件",
      code: "FILE_TOO_LARGE",
      message: `一次最多上传 ${MAX_FILES} 个文件`,
    });
  }
  for (const file of files) {
    if (!fileKind(file)) {
      issues.push({
        fileName: file.name,
        code: "UNSUPPORTED_TYPE",
        message: "仅支持文字型 PDF 或标准 DOCX",
      });
    } else if (file.size === 0) {
      issues.push({
        fileName: file.name,
        code: "EMPTY_FILE",
        message: "文件为空，无法解析",
      });
    } else if (file.size > MAX_FILE_SIZE) {
      issues.push({
        fileName: file.name,
        code: "FILE_TOO_LARGE",
        message: "单个文件不能超过 25 MB",
      });
    }
  }
  return issues;
};
