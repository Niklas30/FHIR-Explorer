/// <reference lib="webworker" />
import { parseTgzPackage } from "./parser";

type WorkerRequest = {
  id: string;
  buffer: ArrayBuffer;
};

type WorkerResponse =
  | { id: string; type: "progress"; progress: number }
  | { id: string; type: "result"; payload: unknown }
  | { id: string; type: "error"; error: string };

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, buffer } = event.data;
  try {
    const parsed = await parseTgzPackage(buffer, {
      onProgress: (progress) => {
        const message: WorkerResponse = { id, type: "progress", progress };
        ctx.postMessage(message);
      },
    });

    const message: WorkerResponse = { id, type: "result", payload: parsed };
    ctx.postMessage(message);
  } catch (error) {
    const message: WorkerResponse = {
      id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    ctx.postMessage(message);
  }
};

export {};
