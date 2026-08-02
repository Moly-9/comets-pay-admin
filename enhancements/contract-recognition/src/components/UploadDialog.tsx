import {
  AlertCircle,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useContractRecognition } from "../hooks/useContractRecognition";
import {
  fileKind,
  MAX_FILES,
  validateFiles,
} from "../parsing/fileValidation";
import type {
  ContractFileRef,
  ContractRecord,
  RecognitionContext,
} from "../types";

interface UploadDialogProps {
  onClose: () => void;
  onCreated: (contract: ContractRecord) => void;
}

const contractId = () => {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `CON-UPL-${date}-${String(Date.now()).slice(-4)}`;
};

const valueFromObject = (
  value: unknown,
  key: string,
): string => {
  if (!value || typeof value !== "object") return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
};

export function UploadDialog({ onClose, onCreated }: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [systemContractNumber, setSystemContractNumber] = useState("");
  const [creatorAccountSnapshot, setCreatorAccountSnapshot] = useState("");
  const [submitError, setSubmitError] = useState("");
  const { parse, progress, isParsing, error } = useContractRecognition();

  const issues = useMemo(() => validateFiles(files), [files]);

  const addFiles = (incoming: File[]) => {
    setSubmitError("");
    setFiles((current) => {
      const known = new Set(
        current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      );
      const next = [...current];
      incoming.forEach((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!known.has(key) && next.length < MAX_FILES) {
          known.add(key);
          next.push(file);
        }
      });
      return next;
    });
  };

  const startRecognition = async () => {
    if (!files.length || issues.length || isParsing) return;
    const context: RecognitionContext = {
      systemContractNumber: systemContractNumber.trim() || undefined,
      creatorAccountSnapshot: creatorAccountSnapshot.trim() || undefined,
    };
    try {
      const result = await parse(files, context);
      const fields = result.fields;
      const resolvedContractNumber =
        systemContractNumber.trim() ||
        (typeof fields.contractNumber.normalizedValue === "string"
          ? fields.contractNumber.normalizedValue
          : "") ||
        contractId();
      const projectName = valueFromObject(
        fields.projectBrand.normalizedValue,
        "projectName",
      );
      const brandName = valueFromObject(
        fields.projectBrand.normalizedValue,
        "brandName",
      );
      const hasConflict = Object.values(fields).some(
        (field) => field.status === "conflict",
      );
      const fileRefs: ContractFileRef[] = files.map((file, index) => {
        const document = result.documents[index];
        return {
          id: document?.id ?? `upload-${index}`,
          name: file.name,
          type: fileKind(file) ?? "pdf",
          objectUrl: URL.createObjectURL(file),
          blob: file,
          documentType: document?.documentType ?? "UNKNOWN",
        };
      });
      const record: ContractRecord = {
        id: resolvedContractNumber,
        ioId:
          typeof fields.ioNumber.normalizedValue === "string"
            ? fields.ioNumber.normalizedValue
            : "待补充",
        name:
          [projectName, brandName].filter(Boolean).join(" · ") ||
          files[0].name.replace(/\.(pdf|docx)$/i, ""),
        advertiser: fields.advertiser.rawValue || "待补充",
        publisher: fields.publisher.rawValue || "待补充",
        projectName,
        brandName,
        status: hasConflict ? "需核对" : "待确认",
        updatedAt: new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date())
          .replaceAll("/", "-"),
        sourceNames: files.map((file) => file.name),
        result,
        fileRefs,
      };
      onCreated(record);
    } catch (parseError) {
      setSubmitError(
        parseError instanceof Error
          ? parseError.message
          : "合同识别失败，请重新选择文件后重试",
      );
    }
  };

  return (
    <div
      className="cr-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isParsing) onClose();
      }}
    >
      <section
        className="cr-modal"
        data-testid="contract-upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-upload-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cr-modal-header">
          <div>
            <h2 id="cr-upload-title">上传合同</h2>
            <p>上传后将在浏览器本地提取合同摘要与付款信息。</p>
          </div>
          <button
            className="cr-icon-button"
            type="button"
            aria-label="关闭"
            disabled={isParsing}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="cr-modal-content">
          <div
            className={`cr-dropzone ${dragActive ? "cr-dropzone-active" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addFiles([...event.dataTransfer.files]);
            }}
          >
            <UploadCloud size={27} />
            <strong>拖放合同文件到此处</strong>
            <span>支持文字型 PDF、标准 DOCX；最多 8 个，单个不超过 25 MB</span>
            <button
              type="button"
              className="cr-button cr-button-secondary"
              onClick={() => inputRef.current?.click()}
            >
              选择文件
            </button>
            <input
              ref={inputRef}
              hidden
              multiple
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                addFiles([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
          </div>

          {files.length ? (
            <div className="cr-upload-files">
              {files.map((file) => {
                const fileProgress = Object.values(progress).find(
                  (item) => item.fileName === file.name,
                );
                const fileIssues = issues.filter(
                  (issue) =>
                    issue.fileName === file.name || issue.fileName === "全部文件",
                );
                return (
                  <article key={`${file.name}-${file.lastModified}`}>
                    <span className="cr-file-icon">
                      <FileText size={18} />
                    </span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {fileProgress ? ` · ${fileProgress.message}` : ""}
                      </small>
                      {fileProgress ? (
                        <span className="cr-progress-track">
                          <i style={{ width: `${fileProgress.progress}%` }} />
                        </span>
                      ) : null}
                      {fileIssues.map((issue) => (
                        <span className="cr-inline-error" key={issue.code}>
                          {issue.message}
                        </span>
                      ))}
                    </div>
                    <button
                      className="cr-icon-button"
                      type="button"
                      aria-label={`移除 ${file.name}`}
                      disabled={isParsing}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((item) => item !== file),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : null}

          <details className="cr-context-details">
            <summary>补充校验信息（选填）</summary>
            <div className="cr-context-grid">
              <label>
                <span>
                  系统合同编号 <small>系统值优先</small>
                </span>
                <input
                  value={systemContractNumber}
                  placeholder="例如 CON-260801-001"
                  onChange={(event) =>
                    setSystemContractNumber(event.target.value)
                  }
                />
              </label>
              <label>
                <span>
                  达人档案收款账户 <small>仅用于冲突比对</small>
                </span>
                <input
                  value={creatorAccountSnapshot}
                  placeholder="账户尾号、IBAN 或收款主体"
                  onChange={(event) =>
                    setCreatorAccountSnapshot(event.target.value)
                  }
                />
              </label>
            </div>
          </details>

          <div className="cr-privacy-note">
            <LockKeyhole size={16} />
            <span>
              文件仅在当前浏览器中解析，不会上传到服务器或第三方服务。
            </span>
          </div>

          {submitError || error ? (
            <div className="cr-error-banner" role="alert">
              <AlertCircle size={17} />
              <span>{submitError || error}</span>
            </div>
          ) : null}
        </div>

        <footer className="cr-modal-footer">
          <button
            type="button"
            className="cr-button cr-button-secondary"
            disabled={isParsing}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="cr-button cr-button-primary"
            disabled={!files.length || Boolean(issues.length) || isParsing}
            onClick={startRecognition}
          >
            {isParsing ? (
              <>
                <LoaderCircle className="cr-spin" size={17} />
                正在解析
              </>
            ) : (
              "上传并识别"
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
