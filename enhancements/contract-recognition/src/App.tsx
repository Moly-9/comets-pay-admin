import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContractDetail } from "./components/ContractDetail";
import { ContractList } from "./components/ContractList";
import { UploadDialog } from "./components/UploadDialog";
import { sampleContracts } from "./data/sampleContracts";
import { createContractRepository } from "./repositories/contractRepository";
import type { ContractRecord } from "./types";
import "./styles.css";

interface AppProps {
  canManage?: boolean;
}

interface Toast {
  title: string;
  message: string;
}

export function ContractRecognitionApp({ canManage = true }: AppProps) {
  const repository = useMemo(() => createContractRepository(), []);
  const [contracts, setContracts] = useState<ContractRecord[]>(sampleContracts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const contractsRef = useRef(contracts);

  useEffect(() => {
    contractsRef.current = contracts;
  }, [contracts]);

  useEffect(() => {
    let active = true;
    repository.list().then((saved) => {
      if (!active) return;
      const savedIds = new Set(saved.map((contract) => contract.id));
      setContracts([
        ...saved.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
        ...sampleContracts.filter((contract) => !savedIds.has(contract.id)),
      ]);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      contractsRef.current.forEach((contract) =>
        contract.fileRefs?.forEach((file) => {
          if (file.objectUrl) URL.revokeObjectURL(file.objectUrl);
        }),
      );
    },
    [],
  );

  const selected = contracts.find((contract) => contract.id === selectedId);

  const save = (
    contract: ContractRecord,
    notify = false,
    replacedId = contract.id,
  ) => {
    setContracts((current) => [
      contract,
      ...current.filter(
        (item) => item.id !== contract.id && item.id !== replacedId,
      ),
    ]);
    if (replacedId !== contract.id) void repository.remove(replacedId);
    void repository.put(contract).catch(() => {
      setToast({
        title: "本地保存失败",
        message: "当前页面仍保留修改，请不要刷新并稍后重试。",
      });
    });
    if (notify) {
      setToast({
        title: "合同资料已更新",
        message: `${contract.id} 的识别字段已全部人工确认。`,
      });
    }
  };

  return (
    <div className="cr-app">
      {selected ? (
        <ContractDetail
          contract={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={(contract) => save(contract)}
          onCommitted={(contract) => {
            save(contract, true, selected.id);
            setSelectedId(contract.id);
          }}
        />
      ) : (
        <ContractList
          contracts={contracts}
          canManage={canManage}
          onOpen={(contract) => setSelectedId(contract.id)}
          onUpload={() => setShowUpload(true)}
        />
      )}

      {showUpload ? (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onCreated={(contract) => {
            save(contract);
            setShowUpload(false);
            setSelectedId(contract.id);
            setToast({
              title: "合同识别完成",
              message: "请核对字段来源，并逐项确认识别结果。",
            });
          }}
        />
      ) : null}

      {toast ? (
        <div className="cr-toast" role="status">
          <i />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <button type="button" aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
