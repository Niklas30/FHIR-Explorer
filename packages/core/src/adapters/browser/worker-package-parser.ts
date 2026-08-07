import { parsePackage } from "@fhir-explorer/core/fhir-importer/parser";
import type { PackageParser } from "@fhir-explorer/core/ports";
import type { ParsedPackage } from "@fhir-explorer/core/fhir-importer/types";

const createWorker = () =>
  new Worker(new URL("./package-parser.worker.ts", import.meta.url), {
    type: "module",
  });

const parsePackageInWorker = (
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

/** Parses off the main thread, so a large IG does not freeze the UI. */
export const workerPackageParser: PackageParser = {
  parse: parsePackageInWorker,
};

/** Parses on the calling thread. Used when workers are unavailable. */
export const inlinePackageParser: PackageParser = {
  parse: (buffer, onProgress) => parsePackage(buffer, { onProgress }),
};
