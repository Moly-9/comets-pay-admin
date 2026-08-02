import { Check, FileSearch2 } from "lucide-react";
import {
  confirmRecognitionField,
  editRecognitionField,
} from "../core/fieldState";
import type {
  RecognitionCandidate,
  RecognitionField,
  SourceLocation,
} from "../types";
import { StatusBadge } from "./StatusBadge";

const sourceLabel = (source: SourceLocation) => {
  if (source.documentType === "SYSTEM") return source.fileName;
  if (source.pageNumber) {
    return `${source.documentType} · 第 ${source.pageNumber} 页`;
  }
  if (source.paragraphIndex) {
    return `${source.documentType} · 第 ${source.paragraphIndex} 段`;
  }
  return source.documentType;
};

const displayValue = (field: RecognitionField) => {
  if (field.editedValue !== undefined) return field.editedValue;
  if (field.rawValue) return field.rawValue;
  return "";
};

interface FieldRowProps {
  field: RecognitionField;
  onChange: (nextField: RecognitionField) => void;
  onLocate: (source: SourceLocation) => void;
}

export function FieldRow({ field, onChange, onLocate }: FieldRowProps) {
  const chooseCandidate = (candidate: RecognitionCandidate) => {
    onChange({
      ...field,
      rawValue: candidate.rawValue,
      normalizedValue: candidate.normalizedValue,
      source: candidate.source,
      confidence: candidate.confidence,
      status: "detected",
    });
  };

  return (
    <article className={`cr-field-row cr-field-row-${field.status}`}>
      <header>
        <label htmlFor={`field-${field.fieldKey}`}>{field.label}</label>
        <StatusBadge status={field.status} />
      </header>
      <div className="cr-field-control">
        <textarea
          id={`field-${field.fieldKey}`}
          rows={field.fieldKey === "beneficiaryAccount" ? 3 : 2}
          value={displayValue(field)}
          placeholder={field.status === "missing" ? "待补充" : "请选择候选值"}
          onChange={(event) =>
            onChange(editRecognitionField(field, event.target.value))
          }
        />
        <button
          className="cr-confirm-button"
          type="button"
          disabled={!field.rawValue.trim() || field.status === "confirmed"}
          onClick={() => onChange(confirmRecognitionField(field))}
        >
          <Check size={15} />
          {field.status === "confirmed" ? "已确认" : "确认"}
        </button>
      </div>

      {field.source ? (
        <button
          className="cr-source-link"
          type="button"
          onClick={() => onLocate(field.source as SourceLocation)}
        >
          <FileSearch2 size={14} />
          <span>{sourceLabel(field.source)}</span>
          <small>{field.source.section || field.source.fileName}</small>
        </button>
      ) : null}

      {field.candidates.length ? (
        <div className="cr-candidates">
          <span>
            {field.status === "missing" ? "可参考候选" : "请选择需要采用的原文"}
          </span>
          {field.candidates.map((candidate, index) => (
            <button
              type="button"
              key={`${candidate.source.fileName}-${candidate.source.pageNumber ?? candidate.source.paragraphIndex ?? index}-${index}`}
              onClick={() => chooseCandidate(candidate)}
            >
              <strong>{candidate.rawValue}</strong>
              <small>{sourceLabel(candidate.source)}</small>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
