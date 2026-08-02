import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Files,
  Info,
  Save,
} from "lucide-react";
import { useMemo, useState } from "react";
import { allFieldsConfirmed } from "../core/fieldState";
import { fieldDefinitions } from "../core/fieldDefinitions";
import type {
  ContractRecord,
  FieldKey,
  RecognitionField,
  RecognitionResult,
  SourceLocation,
} from "../types";
import { DocumentPreview } from "./DocumentPreview";
import { FieldRow } from "./FieldRow";

interface ContractDetailProps {
  contract: ContractRecord;
  onBack: () => void;
  onUpdate: (contract: ContractRecord) => void;
  onCommitted: (contract: ContractRecord) => void;
}

const systemSource = (value: string): SourceLocation => ({
  documentType: "SYSTEM",
  fileName: "原系统合同资料",
  section: "系统字段",
  sourceText: value,
});

const legacyResult = (contract: ContractRecord): RecognitionResult => {
  const values: Partial<Record<FieldKey, { raw: string; normalized: unknown }>> = {
    advertiser: {
      raw: contract.advertiser === "待补充" ? "" : contract.advertiser,
      normalized: contract.advertiser,
    },
    publisher: {
      raw: contract.publisher === "待补充" ? "" : contract.publisher,
      normalized: contract.publisher,
    },
    contractNumber: { raw: contract.id, normalized: contract.id },
    ioNumber: {
      raw: contract.ioId === "待补充" ? "" : contract.ioId,
      normalized: contract.ioId,
    },
    projectBrand: {
      raw: [contract.projectName, contract.brandName].filter(Boolean).join(" / "),
      normalized: {
        projectName: contract.projectName,
        brandName: contract.brandName,
      },
    },
  };
  const fields = Object.fromEntries(
    fieldDefinitions.map(({ key, label }) => {
      const value = values[key];
      const hasValue = Boolean(value?.raw);
      return [
        key,
        {
          fieldKey: key,
          label,
          rawValue: value?.raw ?? "",
          normalizedValue: value?.normalized ?? null,
          source: hasValue ? systemSource(value?.raw ?? "") : null,
          confidence: hasValue ? 1 : 0,
          status: hasValue ? "confirmed" : "missing",
          candidates: [],
        } satisfies RecognitionField,
      ];
    }),
  ) as unknown as Record<FieldKey, RecognitionField>;
  return {
    documents: [],
    fields,
    recognizedAt: new Date().toISOString(),
  };
};

const fieldValue = (
  fields: Record<FieldKey, RecognitionField>,
  key: FieldKey,
) => fields[key].rawValue || "";

export function ContractDetail({
  contract,
  onBack,
  onUpdate,
  onCommitted,
}: ContractDetailProps) {
  const [tab, setTab] = useState<"summary" | "payment" | "documents">("summary");
  const [result, setResult] = useState<RecognitionResult>(
    () => contract.result ?? legacyResult(contract),
  );
  const [activeSource, setActiveSource] = useState<SourceLocation | null>(null);
  const [selectedFileName, setSelectedFileName] = useState(
    contract.result?.documents[0]?.fileName ?? contract.sourceNames[0] ?? "",
  );

  const fieldKeys = useMemo(
    () =>
      fieldDefinitions
        .filter((definition) =>
          tab === "summary"
            ? definition.group === "summary"
            : definition.group === "payment",
        )
        .map((definition) => definition.key),
    [tab],
  );
  const confirmedCount = Object.values(result.fields).filter(
    (field) => field.status === "confirmed",
  ).length;

  const updateField = (field: RecognitionField) => {
    const nextResult = {
      ...result,
      fields: {
        ...result.fields,
        [field.fieldKey]: field,
      },
    };
    setResult(nextResult);
    const hasConflict = Object.values(nextResult.fields).some(
      (item) => item.status === "conflict",
    );
    onUpdate({
      ...contract,
      result: nextResult,
      status: hasConflict ? "需核对" : "待确认",
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    });
  };

  const locateSource = (source: SourceLocation) => {
    setActiveSource(source);
    if (source.documentType !== "SYSTEM") {
      setSelectedFileName(source.fileName);
    }
  };

  const commit = () => {
    if (!allFieldsConfirmed(result.fields)) return;
    const projectBrand = result.fields.projectBrand.normalizedValue;
    const projectName =
      projectBrand && typeof projectBrand === "object"
        ? String((projectBrand as Record<string, unknown>).projectName ?? "")
        : contract.projectName;
    const brandName =
      projectBrand && typeof projectBrand === "object"
        ? String((projectBrand as Record<string, unknown>).brandName ?? "")
        : contract.brandName;
    onCommitted({
      ...contract,
      id: fieldValue(result.fields, "contractNumber") || contract.id,
      ioId: fieldValue(result.fields, "ioNumber") || contract.ioId,
      advertiser: fieldValue(result.fields, "advertiser"),
      publisher: fieldValue(result.fields, "publisher"),
      projectName,
      brandName,
      name: [projectName, brandName].filter(Boolean).join(" · ") || contract.name,
      result,
      status: "已确认",
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    });
  };

  return (
    <div className="cr-page-stack" data-testid="contract-recognition-workspace">
      <div className="cr-detail-heading">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          返回合同列表
        </button>
        <div className="cr-detail-title-row">
          <div>
            <span className="cr-mono">{contract.id}</span>
            <h1>{contract.name}</h1>
            <p>
              {contract.sourceNames.length} 个合同文件 · 最近更新{" "}
              {contract.updatedAt}
            </p>
          </div>
          <button
            type="button"
            className="cr-button cr-button-primary"
            disabled={!allFieldsConfirmed(result.fields)}
            onClick={commit}
          >
            <Save size={16} />
            保存确认结果
          </button>
        </div>
      </div>

      <div className="cr-review-banner">
        <Info size={17} />
        <div>
          <strong>识别结果需要人工确认</strong>
          <span>
            已确认 {confirmedCount} / {fieldDefinitions.length} 项。金额、日期、主体和收款账户不会自动覆盖现有资料；当前结果仅保存在本地浏览器。
          </span>
        </div>
      </div>

      <section className="cr-detail-card">
        <div className="cr-tabs">
          <button
            type="button"
            className={tab === "summary" ? "cr-tab-active" : ""}
            onClick={() => setTab("summary")}
          >
            合同摘要
          </button>
          <button
            type="button"
            className={tab === "payment" ? "cr-tab-active" : ""}
            onClick={() => setTab("payment")}
          >
            付款与 Invoice
          </button>
          <button
            type="button"
            className={tab === "documents" ? "cr-tab-active" : ""}
            onClick={() => setTab("documents")}
          >
            合同文件 <span>{contract.sourceNames.length}</span>
          </button>
        </div>

        {tab === "documents" ? (
          <div className="cr-documents-panel">
            {result.documents.length ? (
              result.documents.map((document) => (
                <article key={document.id}>
                  <span
                    className={
                      document.status === "parsed"
                        ? "cr-document-ok"
                        : "cr-document-error"
                    }
                  >
                    {document.status === "parsed" ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <FileWarning size={19} />
                    )}
                  </span>
                  <div>
                    <strong>{document.fileName}</strong>
                    <small>
                      {document.documentType}
                      {document.pageCount ? ` · ${document.pageCount} 页` : ""}
                      {document.textLength
                        ? ` · ${document.textLength.toLocaleString()} 字符`
                        : ""}
                    </small>
                    {document.errorMessage ? (
                      <p>{document.errorMessage}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="cr-button cr-button-secondary"
                    disabled={document.status !== "parsed"}
                    onClick={() => {
                      setSelectedFileName(document.fileName);
                      setTab("summary");
                    }}
                  >
                    查看原文
                  </button>
                </article>
              ))
            ) : (
              <div className="cr-no-recognition">
                <Files size={30} />
                <strong>历史合同没有字段识别快照</strong>
                <span>重新上传合同文件后可生成来源信息。</span>
              </div>
            )}
          </div>
        ) : (
          <div className="cr-review-layout">
            <DocumentPreview
              documents={result.documents}
              files={contract.fileRefs ?? []}
              activeSource={activeSource}
              selectedFileName={selectedFileName}
              onSelectFile={(fileName) => {
                setSelectedFileName(fileName);
                setActiveSource(null);
              }}
            />
            <section className="cr-fields-panel">
              <header>
                <div>
                  <h2>
                    {tab === "summary" ? "合同摘要" : "付款与 Invoice"}
                  </h2>
                  <p>编辑识别值后逐项确认，点击来源可定位原文。</p>
                </div>
              </header>
              <div className="cr-field-list">
                {fieldKeys.map((key) => (
                  <FieldRow
                    key={key}
                    field={result.fields[key]}
                    onChange={updateField}
                    onLocate={locateSource}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
