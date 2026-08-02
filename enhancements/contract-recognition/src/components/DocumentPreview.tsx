import { FileText, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type {
  ContractFileRef,
  ParsedDocument,
  SourceLocation,
} from "../types";

interface DocumentPreviewProps {
  documents: ParsedDocument[];
  files: ContractFileRef[];
  activeSource: SourceLocation | null;
  onSelectFile: (fileName: string) => void;
  selectedFileName: string;
}

export function DocumentPreview({
  documents,
  files,
  activeSource,
  onSelectFile,
  selectedFileName,
}: DocumentPreviewProps) {
  const textPanelRef = useRef<HTMLDivElement>(null);
  const selectedDocument = documents.find(
    (document) => document.fileName === selectedFileName,
  );
  const selectedFile = files.find((file) => file.name === selectedFileName);
  const isPdf = selectedFile?.type === "pdf";

  useEffect(() => {
    if (!activeSource?.paragraphIndex || !textPanelRef.current) return;
    textPanelRef.current
      .querySelector(
        `[data-paragraph-index="${activeSource.paragraphIndex}"]`,
      )
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSource]);

  const pdfUrl = useMemo(() => {
    if (!isPdf || !selectedFile?.objectUrl) return "";
    const page = activeSource?.fileName === selectedFile.name
      ? activeSource.pageNumber
      : undefined;
    return `${selectedFile.objectUrl}${page ? `#page=${page}&view=FitH` : ""}`;
  }, [activeSource, isPdf, selectedFile]);

  return (
    <section className="cr-preview">
      <header className="cr-preview-header">
        <div>
          <span>合同原文</span>
          <small>文件仅在当前浏览器中处理</small>
        </div>
        <select
          aria-label="选择预览文件"
          value={selectedFileName}
          onChange={(event) => onSelectFile(event.target.value)}
        >
          {documents.map((document) => (
            <option key={document.id} value={document.fileName}>
              {document.fileName}
            </option>
          ))}
        </select>
      </header>

      {selectedDocument?.status !== "parsed" ? (
        <div className="cr-preview-empty">
          <ScanSearch size={30} />
          <strong>{selectedDocument?.errorMessage || "文件无法预览"}</strong>
          <span>请根据提示手动补充合同字段。</span>
        </div>
      ) : isPdf && pdfUrl ? (
        <iframe title={`预览 ${selectedFileName}`} src={pdfUrl} />
      ) : (
        <div className="cr-docx-preview" ref={textPanelRef}>
          {selectedDocument?.blocks.map((block) => (
            <div
              className={[
                `cr-docx-${block.kind}`,
                activeSource?.fileName === selectedFileName &&
                activeSource.paragraphIndex === block.paragraphIndex
                  ? "cr-source-highlight"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-paragraph-index={block.paragraphIndex}
              key={block.id}
            >
              {block.kind === "heading" ? <FileText size={15} /> : null}
              <span>{block.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
