import { useCallback, useRef, useState } from "react";
import { recognizeDocuments } from "../core/recognition";
import type {
  FileParseInput,
  ParseProgress,
  RecognitionContext,
  RecognitionResult,
  WorkerParseResponse,
} from "../types";

const fileId = (file: File, index: number) =>
  `file-${Date.now()}-${index}-${file.name.replace(/\W+/g, "-")}`;

export const useContractRecognition = () => {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<Record<string, ParseProgress>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState("");

  const parse = useCallback(
    async (
      files: File[],
      context: RecognitionContext,
    ): Promise<RecognitionResult> => {
      workerRef.current?.terminate();
      setProgress({});
      setError("");
      setIsParsing(true);

      const inputs: FileParseInput[] = await Promise.all(
        files.map(async (file, index) => ({
          id: fileId(file, index),
          name: file.name,
          mimeType: file.type,
          size: file.size,
          buffer: await file.arrayBuffer(),
        })),
      );
      setProgress(
        Object.fromEntries(
          inputs.map((input) => [
            input.id,
            {
              fileId: input.id,
              fileName: input.name,
              phase: "queued",
              progress: 0,
              message: "等待解析",
            },
          ]),
        ),
      );

      return await new Promise<RecognitionResult>((resolve, reject) => {
        const worker = new Worker(
          new URL("../parsing/contract-parser.worker.ts", import.meta.url),
          { type: "module", name: "contract-parser" },
        );
        workerRef.current = worker;

        const finish = () => {
          worker.terminate();
          workerRef.current = null;
          setIsParsing(false);
        };

        worker.addEventListener(
          "message",
          (event: MessageEvent<WorkerParseResponse>) => {
            const response = event.data;
            if (response.type === "progress") {
              setProgress((current) => ({
                ...current,
                [response.payload.fileId]: response.payload,
              }));
              return;
            }
            if (response.type === "fatal") {
              finish();
              setError(response.payload.message);
              reject(new Error(response.payload.message));
              return;
            }
            finish();
            resolve(recognizeDocuments(response.payload, context));
          },
        );
        worker.addEventListener("error", () => {
          const message = "合同解析进程启动失败，请刷新页面后重试";
          finish();
          setError(message);
          reject(new Error(message));
        });
        worker.postMessage(
          { type: "parse", files: inputs },
          inputs.map((input) => input.buffer),
        );
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsParsing(false);
  }, []);

  return {
    parse,
    cancel,
    progress,
    isParsing,
    error,
  };
};
