import type { ParsedPackage } from "./types";

const createWorker = () =>
  new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

export const parsePackageInWorker = (
  buffer: ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<ParsedPackage> => {
  const id = Math.random().toString(36).slice(2);
  const worker = createWorker();

  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as
        | { id: string; type: "progress"; progress: number }
        | { id: string; type: "result"; payload: ParsedPackage }
        | { id: string; type: "error"; error: string };

      if (message.id !== id) return;

      if (message.type === "progress") {
        onProgress?.(message.progress);
        return;
      }

      if (message.type === "result") {
        worker.terminate();
        resolve(message.payload);
        return;
      }

      if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.error));
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(event.error ?? new Error("Worker error"));
    };

    worker.postMessage({ id, buffer }, [buffer]);
  });
};
