import { FileSearch2 } from "lucide-react";
import { editRecognitionField } from "../core/fieldState";
import type {
  RecognitionCandidate,
  RecognitionField,
  SourceLocation,
} from "../types";
import { StatusBadge } from "./StatusBadge";

const sourceLabel = (source: SourceLocation) => {
  if (source.documentType === "SYSTEM") return source.fileName;
  if (source.pageNumber) {
    return `${source.documentType} · 第${source.pageNumber}页`;
  }
  if (source.paragraphIndex) {
    return `${source.documentType} · 第${source.paragraphIndex}段`;
  }
  return source.documentType;
};

const displayValue = (field: RecognitionField) =>
  field.editedValue !== undefined ? field.editedValue : field.rawValue;

interface FieldRowProps {
  editing: boolean;
  field: RecognitionField;
  onChange: (nextField: RecognitionField) => void;
  onLocate: (source: SourceLocation) => void;
}

export function FieldRow({
  editing,
  field,
  onChange,
  onLocate,
}: FieldRowProps) {
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

  if (!editing) {
    return (
      <div className={`cr-field-row cr-field-row-${field.status}`}>
        <dt>{field.label}</dt>
        <dd>
          <div className="cr-field-value-line">
            <strong className={!displayValue(field) ? "cr-value-missing" : ""}>
              {displayValue(field) || "待补充"}
            </strong>
            {field.status === "conflict" ? (
              <StatusBadge status={field.status} />
            ) : null}
          </div>
          {field.source ? (
            <button
              className="cr-source-link"
              type="button"
              onClick={() => onLocate(field.source as SourceLocation)}
            >
              <FileSearch2 size={13} />
              <span>{sourceLabel(field.source)}</span>
            </button>
          ) : (
            <span className="cr-source-missing">暂无来源</span>
          )}
        </dd>
      </div>
    );
  }

  return (
    <div className={`cr-field-row cr-field-row-${field.status}`}>
      <dt>
        <label htmlFor={`field-${field.fieldKey}`}>{field.label}</label>
      </dt>
      <dd>
        <div className="cr-field-edit-heading">
          <StatusBadge status={field.status} />
        </div>
        <textarea
          id={`field-${field.fieldKey}`}
          rows={field.fieldKey === "beneficiaryAccount" ? 3 : 2}
          value={displayValue(field)}
          placeholder="待补充"
          onChange={(event) =>
            onChange(editRecognitionField(field, event.target.value))
          }
        />

        {field.source ? (
          <button
            className="cr-source-link"
            type="button"
            onClick={() => onLocate(field.source as SourceLocation)}
          >
            <FileSearch2 size={13} />
            <span>{sourceLabel(field.source)}</span>
            <small>{field.source.section || field.source.fileName}</small>
          </button>
        ) : null}

        {field.candidates.length ? (
          <div className="cr-candidates">
            <span>候选结果</span>
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
      </dd>
    </div>
  );
}
