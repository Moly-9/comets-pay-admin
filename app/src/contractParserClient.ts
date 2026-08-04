import type {
  ContractParserFileInput,
  ContractParserResponse,
  ParsedContractDocument,
  ContractUploadDocumentType,
} from './contractRecognitionTypes';

export const MAX_CONTRACT_FILE_SIZE = 30 * 1024 * 1024;
export const MAX_CONTRACT_FILE_COUNT = 10;

export type SelectedContractFile = {
  id: string;
  file: File;
  documentType: ContractUploadDocumentType;
};

const acceptedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '',
]);

export const validateContractFile = (file: File) => {
  if (!file.size) return '文件为空，无法解析。';
  if (file.size > MAX_CONTRACT_FILE_SIZE) return '单个文件不能超过 30 MB。';
  if (!/\.(pdf|docx)$/i.test(file.name)) return '仅支持文字型 PDF 或标准 DOCX 文件。';
  if (!acceptedMimeTypes.has(file.type)) return '文件 MIME 类型与 PDF/DOCX 不匹配。';
  return '';
};

export const createSelectedContractFiles = (files: File[]): SelectedContractFile[] => (
  files.map((file, index) => ({
    id: globalThis.crypto?.randomUUID?.() ?? `contract-file-${Date.now()}-${index}`,
    file,
    documentType: 'STANDARD_TERMS',
  }))
);

export const parseContractFiles = async (
  selectedFiles: SelectedContractFile[],
): Promise<ParsedContractDocument[]> => {
  if (!selectedFiles.length) throw new Error('请至少选择一份合同文件。');
  if (selectedFiles.length > MAX_CONTRACT_FILE_COUNT) throw new Error(`一次最多上传 ${MAX_CONTRACT_FILE_COUNT} 份合同文件。`);
  const validationError = selectedFiles.map(({ file }) => validateContractFile(file)).find(Boolean);
  if (validationError) throw new Error(validationError);

  const inputs: ContractParserFileInput[] = await Promise.all(selectedFiles.map(async ({ id, file, documentType }) => ({
    id,
    fileName: file.name,
    mimeType: file.type,
    documentType,
    buffer: await file.arrayBuffer(),
  })));

  const worker = new Worker(new URL('./contractParser.worker.ts', import.meta.url), { type: 'module' });
  const requestId = globalThis.crypto?.randomUUID?.() ?? `contract-parse-${Date.now()}`;

  return new Promise<ParsedContractDocument[]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('合同解析超时，请减少文件数量后重试。'));
    }, 90_000);

    worker.addEventListener('message', (event: MessageEvent<ContractParserResponse>) => {
      if (event.data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) resolve(event.data.documents);
      else reject(new Error(event.data.error));
    });
    worker.addEventListener('error', () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error('合同解析 Worker 启动失败。'));
    });
    worker.postMessage(
      { requestId, files: inputs },
      inputs.map((input) => input.buffer),
    );
  });
};
