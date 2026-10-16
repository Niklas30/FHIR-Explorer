import type { HttpClient } from "@fhir-explorer/core/ports";
import type { HostToWebview, WebviewToHost } from "@webview/protocol";

/** The object VS Code injects into the webview. */
type VsCodeApi = {
  postMessage: (message: WebviewToHost) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;

export const vscode = acquireVsCodeApi();

export const onHostMessage = (handler: (message: HostToWebview) => void) => {
  const listener = (event: MessageEvent<HostToWebview>) => handler(event.data);
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
};

let nextRequestId = 0;
const pending = new Map<string, (result: { body?: unknown; error?: string }) => void>();

export const resolveExpansion = (
  requestId: string,
  result: { body?: unknown; error?: string }
) => {
  pending.get(requestId)?.(result);
  pending.delete(requestId);
};

/**
 * Terminology requests go through the host rather than the webview's own
 * `fetch`: the CSP here forbids remote connections, and the host is where the
 * user's proxy and certificate settings apply.
 */
export const hostHttpClient: HttpClient = {
  getArrayBuffer: async () => {
    throw new Error("Binary downloads are not available in the webview.");
  },
  getJson: async <T>(url: string) => {
    const requestId = `expand-${(nextRequestId += 1)}`;
    return await new Promise<T>((resolve, reject) => {
      pending.set(requestId, ({ body, error }) =>
        error ? reject(new Error(error)) : resolve(body as T)
      );
      vscode.postMessage({ type: "expandValueSet", requestId, url });
    });
  },
};
