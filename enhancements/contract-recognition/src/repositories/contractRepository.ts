import type { ContractRecord } from "../types";

export interface ContractRepository {
  list(): Promise<ContractRecord[]>;
  put(contract: ContractRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

const DATABASE_NAME = "comets-pay-contract-recognition";
const STORE_NAME = "contracts";
const DATABASE_VERSION = 1;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("无法打开本地合同仓库")),
    );
  });

const stripTransientFileRefs = (contract: ContractRecord): ContractRecord => ({
  ...contract,
  fileRefs: contract.fileRefs?.map(({ objectUrl: _objectUrl, ...file }) => ({
    ...file,
    objectUrl: "",
  })),
});

const restoreObjectUrls = (contract: ContractRecord): ContractRecord => ({
  ...contract,
  fileRefs: contract.fileRefs?.map((file) => ({
    ...file,
    objectUrl: file.blob ? URL.createObjectURL(file.blob) : "",
  })),
});

export class IndexedDbContractRepository implements ContractRepository {
  async list(): Promise<ContractRecord[]> {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.addEventListener("success", () =>
          resolve(
            (request.result as ContractRecord[]).map(restoreObjectUrls),
          ),
        );
        request.addEventListener("error", () =>
          reject(request.error ?? new Error("读取本地合同失败")),
        );
      });
    } finally {
      database.close();
    }
  }

  async put(contract: ContractRecord): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(stripTransientFileRefs(contract));
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("error", () =>
          reject(transaction.error ?? new Error("保存本地合同失败")),
        );
      });
    } finally {
      database.close();
    }
  }

  async remove(id: string): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(id);
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("error", () =>
          reject(transaction.error ?? new Error("删除本地合同失败")),
        );
      });
    } finally {
      database.close();
    }
  }
}

export class MemoryContractRepository implements ContractRepository {
  private records = new Map<string, ContractRecord>();

  async list() {
    return [...this.records.values()];
  }

  async put(contract: ContractRecord) {
    this.records.set(contract.id, structuredClone(stripTransientFileRefs(contract)));
  }

  async remove(id: string) {
    this.records.delete(id);
  }
}

export const createContractRepository = (): ContractRepository =>
  typeof indexedDB === "undefined"
    ? new MemoryContractRepository()
    : new IndexedDbContractRepository();
