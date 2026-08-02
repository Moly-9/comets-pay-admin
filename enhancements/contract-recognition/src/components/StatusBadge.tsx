import type { RecognitionStatus } from "../types";

const statusLabels: Record<RecognitionStatus, string> = {
  detected: "待确认",
  missing: "待补充",
  conflict: "需核对",
  confirmed: "已确认",
};

export function StatusBadge({ status }: { status: RecognitionStatus }) {
  return (
    <span className={`cr-status cr-status-${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
