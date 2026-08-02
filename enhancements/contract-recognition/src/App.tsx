import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContractDetail } from "./components/ContractDetail";
import { UploadDialog } from "./components/UploadDialog";
import { createContractRepository } from "./repositories/contractRepository";
import type { ContractRecord } from "./types";
import "./styles.css";

export const OPEN_CONTRACT_UPLOAD_EVENT = "comets-pay:open-contract-upload";

interface AppProps {
  initialOpen?: boolean;
}

interface Toast {
  title: string;
  message: string;
  tone?: "success" | "error";
}

export function ContractRecognitionApp({ initialOpen = false }: AppProps) {
  const repository = useMemo(() => createContractRepository(), []);
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [showUpload, setShowUpload] = useState(initialOpen);
  const [toast, setToast] = useState<Toast | null>(null);
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
    document.body.classList.toggle("cr-recognition-open", Boolean(selected));
    return () => document.body.classList.remove("cr-recognition-open");
  }, [selected]);

  useEffect(() => {
    const openUpload = () => {
      setSelected(null);
      setShowUpload(true);
    };
    window.addEventListener(OPEN_CONTRACT_UPLOAD_EVENT, openUpload);
    return () =>
      window.removeEventListener(OPEN_CONTRACT_UPLOAD_EVENT, openUpload);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      selectedRef.current?.fileRefs?.forEach((file) => {
        if (file.objectUrl) URL.revokeObjectURL(file.objectUrl);
      });
    },
    [],
  );

  const save = (contract: ContractRecord, committed = false) => {
    setSelected(contract);
    void repository.put(contract).catch(() => {
      setToast({
        title: "本地保存失败",
        message: "当前页面仍保留修改，请不要刷新并稍后重试。",
        tone: "error",
      });
    });
    if (committed) {
      setToast({
        title: "合同资料已确认",
        message: "识别结果已保存到浏览器本地，未写入远端系统。",
      });
    }
  };

  return (
    <div className="cr-app">
      {selected ? (
        <div className="cr-workspace-layer">
          <ContractDetail
            contract={selected}
            onBack={() => setSelected(null)}
            onUpdate={(contract) => save(contract)}
            onCommitted={(contract) => save(contract, true)}
          />
        </div>
      ) : null}

      {showUpload ? (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onCreated={(contract) => {
            save(contract);
            setShowUpload(false);
            setToast({
              title: "合同识别完成",
              message: "请核对字段来源，并逐项确认识别结果。",
            });
          }}
        />
      ) : null}

      {toast ? (
        <div
          className={`cr-toast ${toast.tone === "error" ? "cr-toast-error" : ""}`}
          role="status"
        >
          <i />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
