import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  Files,
  Pencil,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { confirmPopulatedFields } from "../core/fieldState";
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
  onCommitted: (contract: ContractRecord) => void;
}

type DetailTab = "summary" | "fulfillment" | "payment" | "validation";

const tabFieldKeys: Record<Exclude<DetailTab, "validation">, FieldKey[]> = {
  summary: ["advertiser", "publisher", "contractNumber", "effectiveDate"],
  fulfillment: [
    "ioNumber",
    "projectBrand",
    "platformChannel",
    "campaignPeriod",
  ],
  payment: [
    "projectTotalFees",
    "invoiceIssuePeriod",
    "paymentTerm",
    "paymentMethod",
    "transferFee",
    "beneficiaryAccount",
  ],
};

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
) => fields[key].rawValue.trim();

const projectBrandValue = (
  fields: Record<FieldKey, RecognitionField>,
  contract: ContractRecord,
) => {
  const field = fields.projectBrand;
  if (field.editedValue !== undefined) {
    const [projectName = "", brandName = ""] = field.rawValue
      .split(/\s*(?:\/|·)\s*/, 2)
      .map((item) => item.trim());
    return { projectName, brandName };
  }
  const normalized = field.normalizedValue;
  if (normalized && typeof normalized === "object") {
    return {
      projectName: String(
        (normalized as Record<string, unknown>).projectName ?? "",
      ),
      brandName: String(
        (normalized as Record<string, unknown>).brandName ?? "",
      ),
    };
  }
  return {
    projectName: contract.projectName,
    brandName: contract.brandName,
  };
};

export function ContractDetail({
  contract,
  onBack,
  onCommitted,
}: ContractDetailProps) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const [result, setResult] = useState<RecognitionResult>(
    () => contract.result ?? legacyResult(contract),
  );
  const [editBaseline, setEditBaseline] = useState<RecognitionResult | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceLocation | null>(null);
  const [selectedFileName, setSelectedFileName] = useState(
    contract.result?.documents[0]?.fileName ?? contract.sourceNames[0] ?? "",
  );

  const fieldKeys = useMemo(
    () => (tab === "validation" ? [] : tabFieldKeys[tab]),
    [tab],
  );
  const confirmedCount = Object.values(result.fields).filter(
    (field) => field.status === "confirmed",
  ).length;
  const pendingCount = Object.values(result.fields).filter(
    (field) => field.status !== "confirmed",
  ).length;
  const hasConfirmableFields = Object.values(result.fields).some(
    (field) => field.rawValue.trim() && field.status !== "confirmed",
  );
  const hasSavedConfirmation =
    confirmedCount > 0 && !hasConfirmableFields;

  const updateField = (field: RecognitionField) => {
    setResult((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field.fieldKey]: field,
      },
    }));
  };

  const locateSource = (source: SourceLocation) => {
    setActiveSource(source);
    if (source.documentType !== "SYSTEM") {
      setSelectedFileName(source.fileName);
    }
  };

  const startEditing = () => {
    setEditBaseline(result);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (editBaseline) setResult(editBaseline);
    setEditBaseline(null);
    setIsEditing(false);
  };

  const commit = () => {
    const confirmedFields = confirmPopulatedFields(result.fields);
    const nextResult = { ...result, fields: confirmedFields };
    const { projectName, brandName } = projectBrandValue(
      confirmedFields,
      contract,
    );
    const hasUnresolved = Object.values(confirmedFields).some(
      (field) => field.status === "missing" || field.status === "conflict",
    );
    const nextContract: ContractRecord = {
      ...contract,
      id: fieldValue(confirmedFields, "contractNumber") || contract.id,
      ioId: fieldValue(confirmedFields, "ioNumber") || contract.ioId,
      advertiser: fieldValue(confirmedFields, "advertiser") || "待补充",
      publisher: fieldValue(confirmedFields, "publisher") || "待补充",
      projectName,
      brandName,
      name:
        [projectName, brandName].filter(Boolean).join(" · ") || contract.name,
      result: nextResult,
      status: hasUnresolved ? "需核对" : "已确认",
      updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    };
    setResult(nextResult);
    setEditBaseline(null);
    setIsEditing(false);
    onCommitted(nextContract);
  };

  return (
    <div className="cr-page-stack" data-testid="contract-recognition-workspace">
      <div className="cr-detail-heading">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} />
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
          <div className="cr-detail-actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="cr-button cr-button-secondary"
                  onClick={cancelEditing}
                >
                  <X size={15} />
                  取消修改
                </button>
                <button
                  type="button"
                  className="cr-button cr-button-confirm"
                  onClick={commit}
                >
                  <Check size={15} />
                  同意确认并保存
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="cr-button cr-button-edit"
                  onClick={startEditing}
                >
                  <Pencil size={15} />
                  修改解析内容
                </button>
                <button
                  type="button"
                  className="cr-button cr-button-confirm"
                  disabled={!hasConfirmableFields}
                  onClick={commit}
                >
                  <CheckCircle2 size={15} />
                  {hasConfirmableFields ? "确认解析内容" : "已确认解析内容"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="cr-review-banner">
        <FileCheck2 size={17} />
        <div>
          <strong>
            {isEditing
              ? "正在修改解析内容"
              : hasSavedConfirmation
                ? "解析结果已确认保存"
                : "解析结果等待确认"}
          </strong>
          <span>
            {isEditing
              ? "修改只作用于当前浏览器中的识别结果，保存前不会覆盖原资料。"
              : `已确认 ${confirmedCount} 项，${pendingCount} 项待确认或补充。可直接确认解析结果，或修改后再保存。`}
          </span>
        </div>
      </div>

      <section className="cr-detail-card">
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

          <section className="cr-details-panel">
            <div className="cr-tabs" role="tablist" aria-label="合同详情分类">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "summary"}
                className={tab === "summary" ? "cr-tab-active" : ""}
                onClick={() => setTab("summary")}
              >
                合同摘要
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "fulfillment"}
                className={tab === "fulfillment" ? "cr-tab-active" : ""}
                onClick={() => setTab("fulfillment")}
              >
                IO与履约
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "payment"}
                className={tab === "payment" ? "cr-tab-active" : ""}
                onClick={() => setTab("payment")}
              >
                付款与Invoice
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "validation"}
                className={tab === "validation" ? "cr-tab-active" : ""}
                onClick={() => setTab("validation")}
              >
                校验记录
              </button>
            </div>

            {tab === "validation" ? (
              <div className="cr-documents-panel">
                <header className="cr-structured-header">
                  <div>
                    <CheckCircle2 size={18} />
                    <div>
                      <h2>文件校验记录</h2>
                      <p>查看解析状态、文件类型和异常提示</p>
                    </div>
                  </div>
                </header>
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
                          <CheckCircle2 size={18} />
                        ) : (
                          <FileWarning size={18} />
                        )}
                      </span>
                      <div>
                        <strong>{document.fileName}</strong>
                        <small>
                          {document.documentType}
                          {document.pageCount
                            ? ` · ${document.pageCount} 页`
                            : ""}
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
                        onClick={() => setSelectedFileName(document.fileName)}
                      >
                        查看原文
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="cr-no-recognition">
                    <Files size={28} />
                    <strong>没有字段识别快照</strong>
                    <span>重新上传合同文件后可生成校验记录。</span>
                  </div>
                )}
              </div>
            ) : (
              <section className="cr-fields-panel">
                <header className="cr-structured-header">
                  <div>
                    <FileCheck2 size={18} />
                    <div>
                      <h2>结构化合同信息</h2>
                      <p>
                        {isEditing
                          ? "编辑完成后统一确认并保存"
                          : "每个字段保留合同来源位置"}
                      </p>
                    </div>
                  </div>
                </header>
                <dl className="cr-field-list">
                  {fieldKeys.map((key) => (
                    <FieldRow
                      key={key}
                      editing={isEditing}
                      field={result.fields[key]}
                      onChange={updateField}
                      onLocate={locateSource}
                    />
                  ))}
                </dl>
              </section>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
